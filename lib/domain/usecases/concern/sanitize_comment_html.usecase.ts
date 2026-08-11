/** SW-safe HTML helpers (no DOMParser). Keep Frappe-ish comment tags. */

const ALLOWED_TAG =
  /^(?:a|b|blockquote|br|code|div|em|h1|h2|h3|i|img|li|ol|p|pre|s|span|strong|strike|u|ul)$/i;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function commentHtmlToPlainText(html: string): string {
  return decodeEntities(
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isBlankCommentHtml(html: string): boolean {
  return !commentHtmlToPlainText(html);
}

function sanitizeOpenTag(raw: string): string {
  const match = raw.match(/^<\s*([a-z0-9]+)([^>]*)>/i);
  if (!match) return "";
  const tag = match[1]!.toLowerCase();
  if (!ALLOWED_TAG.test(tag)) return "";

  if (tag === "br") return "<br>";

  const attrs = match[2] || "";
  const kept: string[] = [];

  if (tag === "a") {
    const href = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const value = (href?.[2] || href?.[3] || href?.[4] || "").trim();
    if (/^(https?:|mailto:|\/|#)/i.test(value)) {
      kept.push(`href="${value.replaceAll('"', "")}"`);
      kept.push('target="_blank"');
      kept.push('rel="noopener noreferrer"');
    }
  }

  if (tag === "img") {
    const src = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const value = (src?.[2] || src?.[3] || src?.[4] || "").trim();
    if (/^(https?:|\/)/i.test(value) || /^data:image\//i.test(value)) {
      kept.push(`src="${value.replaceAll('"', "")}"`);
      kept.push('style="max-width:100%;height:auto"');
    } else {
      return "";
    }
    const alt = attrs.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (alt) kept.push(`alt="${(alt[2] || alt[3] || "").replaceAll('"', "")}"`);
  }

  return kept.length ? `<${tag} ${kept.join(" ")}>` : `<${tag}>`;
}

/** Strip scripts / handlers; keep tags Desk comments commonly use. */
export function sanitizeCommentHtml(html: string): string {
  let out = String(html || "");
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/javascript:/gi, "");

  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tag: string, rest: string) => {
    const name = tag.toLowerCase();
    if (full.startsWith("</")) {
      return ALLOWED_TAG.test(name) ? `</${name}>` : "";
    }
    if (full.endsWith("/>") || name === "br" || name === "img") {
      const open = sanitizeOpenTag(`<${name}${rest}>`);
      return open;
    }
    return sanitizeOpenTag(`<${name}${rest}>`);
  });

  return out.trim();
}
