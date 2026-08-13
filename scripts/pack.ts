/**
 * Pack dist/ into faye-vX.Y.Z.zip and bump version.
 *
 * Usage:
 *   bun run pack                 # ask (default: patch bump)
 *   bun run pack -- --patch      # auto patch 1.0.0 → 1.0.1
 *   bun run pack -- --minor      # auto minor 1.0.0 → 1.1.0
 *   bun run pack -- --major      # auto major 1.0.0 → 2.0.0
 *   bun run pack -- --version 1.2.3
 *   bun run pack -- -y           # non-interactive patch bump
 *   bun run pack -- --skip-build # zip existing dist only
 */

import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { $ } from "bun";
import { deflateRawSync } from "node:zlib";

const ROOT = process.cwd();
const PACKAGE_PATH = join(ROOT, "package.json");
const MANIFEST_PATH = join(ROOT, "manifest.json");
const DIST = join(ROOT, "dist");
const OUT_DIR = join(ROOT, "releases");

type BumpKind = "patch" | "minor" | "major";

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let bump: BumpKind | null = null;
  let version: string | null = null;
  let yes = false;
  let skipBuild = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--patch" || a === "-p") bump = "patch";
    else if (a === "--minor" || a === "-m") bump = "minor";
    else if (a === "--major" || a === "-M") bump = "major";
    else if (a === "--version" || a === "-v") {
      version = args[++i] ?? null;
    } else if (a.startsWith("--version=")) {
      version = a.slice("--version=".length);
    } else if (a === "-y" || a === "--yes") yes = true;
    else if (a === "--skip-build") skipBuild = true;
    else if (a === "--help" || a === "-h") {
      console.log(`Pack Faye dist into a versioned zip.

  bun run pack                 Ask (default patch bump)
  bun run pack -- --patch      Auto patch
  bun run pack -- --minor      Auto minor
  bun run pack -- --major      Auto major
  bun run pack -- --version X.Y.Z
  bun run pack -- -y           Non-interactive patch
  bun run pack -- --skip-build Zip current dist only`);
      process.exit(0);
    }
  }

  return { bump, version, yes, skipBuild };
}

function isSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v);
}

function bumpSemver(current: string, kind: BumpKind): string {
  const parts = current.split(".").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid current version: ${current}`);
  }
  let [major, minor, patch] = parts as [number, number, number];
  if (kind === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (kind === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function resolveVersion(
  current: string,
  opts: ReturnType<typeof parseArgs>
): Promise<string> {
  if (opts.version) {
    if (!isSemver(opts.version)) {
      throw new Error(`Invalid --version ${opts.version} (want X.Y.Z)`);
    }
    return opts.version;
  }

  const kind = opts.bump ?? "patch";
  const suggested = bumpSemver(current, kind);

  if (opts.yes || opts.bump) {
    return suggested;
  }

  const answer = prompt(
    `Current version ${current}. New version [${suggested}] (Enter=accept, or type X.Y.Z):`
  );
  const next = (answer ?? "").trim() || suggested;
  if (!isSemver(next)) {
    throw new Error(`Invalid version: ${next}`);
  }
  return next;
}

async function listDistFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (current: string) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) out.push(full);
    }
  };
  await walk(dir);
  return out.sort();
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Build a zip with forward-slash paths (no Windows ".\" prefixes). */
async function zipDist(version: string): Promise<string> {
  await mkdir(OUT_DIR, { recursive: true });
  const zipName = `faye-v${version}.zip`;
  const zipPath = join(OUT_DIR, zipName);
  try {
    await unlink(zipPath);
  } catch {
    /* missing */
  }

  const files = await listDistFiles(DIST);
  if (!files.length) throw new Error("dist/ is empty — build first");

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const full of files) {
    const name = relative(DIST, full).split(sep).join("/");
    if (!name || name.startsWith("..")) continue;
    const nameBytes = new TextEncoder().encode(name);
    const data = new Uint8Array(await readFile(full));
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);

    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(checksum),
      u32(compressed.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);

    const centralHeader = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(checksum),
      u32(compressed.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);

    localParts.push(localHeader, compressed);
    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const central = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(centralParts.length),
    u16(centralParts.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);

  await writeFile(zipPath, concat([...localParts, central, end]));
  return zipPath;
}

async function main(): Promise<void> {
  const opts = parseArgs(Bun.argv);
  const pkg = await readJson<{ version: string; name?: string }>(PACKAGE_PATH);
  const manifest = await readJson<Record<string, unknown>>(MANIFEST_PATH);

  const current =
    (typeof manifest.version === "string" && manifest.version) ||
    pkg.version ||
    "0.0.0";
  const next = await resolveVersion(current, opts);

  pkg.version = next;
  manifest.version = next;
  await writeJson(PACKAGE_PATH, pkg);
  await writeJson(MANIFEST_PATH, manifest);
  console.log(`Version → ${next}`);

  if (!opts.skipBuild) {
    console.log("Building…");
    await $`bun run build`;
  } else {
    const manifestInDist = Bun.file(join(DIST, "manifest.json"));
    if (!(await manifestInDist.exists())) {
      throw new Error("dist/ missing — run without --skip-build first");
    }
    // Keep dist manifest in sync when skipping full rebuild.
    await writeJson(join(DIST, "manifest.json"), manifest);
  }

  const zipPath = await zipDist(next);
  console.log(`Packed ${zipPath}`);
  console.log(`Load unpacked from unzipped folder, or attach to GitHub release.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
