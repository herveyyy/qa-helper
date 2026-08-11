import { defaultIconUrl } from "./defaults.ts";

/** Initials avatar as SVG data URL when ERP user_image is missing/broken. */
export function initialsAvatarUrl(nameOrEmail: string): string {
  const label = (nameOrEmail || "?").trim();
  const parts = label.split(/[\s@._-]+/).filter(Boolean);
  const initials = (
    parts.length >= 2
      ? `${parts[0]![0] || ""}${parts[1]![0] || ""}`
      : (parts[0] || "?").slice(0, 2)
  ).toUpperCase();

  // Monochrome: hash → gray step (no accent hues).
  const tone =
    28 +
    (Math.abs(
      Array.from(label).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    ) %
      40);
  const bg = `hsl(0 0% ${tone}%)`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <text x="32" y="34" text-anchor="middle" dominant-baseline="middle"
      font-family="system-ui,Segoe UI,sans-serif" font-size="22" font-weight="600" fill="#fff">${escapeXml(
        initials
      )}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function avatarFallbackUrl(nameOrEmail?: string | null): string {
  const name = (nameOrEmail || "").trim();
  if (name) return initialsAvatarUrl(name);
  return defaultIconUrl();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
