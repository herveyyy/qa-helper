import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const watch = Bun.argv.includes("--watch");
const DIST = "dist";

type Target = {
  entry: string;
  outdir: string;
  naming: string;
};

const targets: Target[] = [
  { entry: "src/content/widget.ts", outdir: `${DIST}/content`, naming: "widget.js" },
  { entry: "src/options/options.ts", outdir: `${DIST}/options`, naming: "options.js" },
  { entry: "src/pages/login.ts", outdir: `${DIST}/pages`, naming: "login.js" },
  { entry: "src/pages/user.ts", outdir: `${DIST}/pages`, naming: "user.js" },
  {
    entry: "src/background/service-worker.ts",
    outdir: `${DIST}/background`,
    naming: "service-worker.js",
  },
];

async function ensureParent(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function copyStatic(): Promise<void> {
  await mkdir(DIST, { recursive: true });
  await cp("manifest.json", join(DIST, "manifest.json"));
  await cp("assets", join(DIST, "assets"), { recursive: true });
  await ensureParent(join(DIST, "options/options.html"));
  await cp("src/options/options.html", join(DIST, "options/options.html"));
  await ensureParent(join(DIST, "pages/login.html"));
  await cp("src/pages/login.html", join(DIST, "pages/login.html"));
  await cp("src/pages/user.html", join(DIST, "pages/user.html"));
}

async function buildTarget({ entry, outdir, naming }: Target): Promise<void> {
  await mkdir(outdir, { recursive: true });
  const result = await Bun.build({
    entrypoints: [entry],
    outdir,
    naming,
    target: "browser",
    format: "iife",
    sourcemap: "linked",
    minify: false,
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error(`Bun build failed for ${entry}`);
  }
}

async function buildCss(): Promise<void> {
  const jobs = [
    ["./src/styles/widget.css", `./${DIST}/content/widget.css`],
    ["./src/styles/options.css", `./${DIST}/options/options.css`],
    ["./src/styles/login.css", `./${DIST}/pages/login.css`],
    ["./src/styles/user.css", `./${DIST}/pages/user.css`],
  ] as const;

  for (const [input, output] of jobs) {
    const result = Bun.spawnSync(
      ["bunx", "@tailwindcss/cli", "-i", input, "-o", output, "-m"],
      { stdout: "inherit", stderr: "inherit" }
    );
    if (result.exitCode !== 0) {
      throw new Error(`Tailwind build failed for ${input}`);
    }
  }
}

async function buildAll(): Promise<void> {
  await rm(DIST, { recursive: true, force: true });
  await copyStatic();
  await Promise.all(targets.map(buildTarget));
  await buildCss();
  console.log(`built → ${DIST}/`);
}

await buildAll();

if (watch) {
  console.log("watching src/**");
  const watcher = Bun.watch("src");
  let pending: Timer | null = null;

  for await (const event of watcher) {
    if (!/\.(ts|css|html)$/.test(event.path)) continue;
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      buildAll().catch((error) => console.error(error));
    }, 50);
  }
}
