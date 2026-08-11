/** True if the page URL is allowed by any pattern (exact host, suffix, or full origin). */
export function isUrlAllowed(pageUrl: string, patterns: string[]): boolean {
  if (!patterns.length) return false;

  let hostname: string;
  let origin: string;
  try {
    const u = new URL(pageUrl);
    hostname = u.hostname.toLowerCase();
    origin = u.origin.toLowerCase();
  } catch {
    return false;
  }

  return patterns.some((raw) => matchesPattern(hostname, origin, raw.trim()));
}

function matchesPattern(hostname: string, origin: string, pattern: string): boolean {
  if (!pattern) return false;

  const lower = pattern.toLowerCase();

  if (lower.includes("://")) {
    try {
      const p = new URL(lower);
      return origin === p.origin.toLowerCase();
    } catch {
      return false;
    }
  }

  if (lower.startsWith("*.")) {
    const base = lower.slice(2);
    if (!base) return false;
    return hostname === base || hostname.endsWith(`.${base}`);
  }

  // "wela.dev" → wela.dev and *.wela.dev only (not arbitrary substring).
  return hostname === lower || hostname.endsWith(`.${lower}`);
}
