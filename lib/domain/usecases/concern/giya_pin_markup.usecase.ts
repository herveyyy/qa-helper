import type { GiyaPinPayload } from "../../../entities/concern.type";
import {
  commentHtmlToPlainText,
  sanitizeCommentHtml,
} from "./sanitize_comment_html.usecase";

const MARKER = "data-giya-pin";

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildEnvSpecsHtml(specs: NonNullable<GiyaPinPayload["envSpecs"]>): string {
  if (specs.length === 0) return "";
  const rows = specs
    .map(
      (s) =>
        `<li><strong>${escapeHtml(s.label)}:</strong> ${escapeHtml(s.value)}</li>`
    )
    .join("");
  return (
    `<details style="margin-top:8px">` +
    `<summary><small>System specs</small></summary>` +
    `<ul style="margin:6px 0 0;padding-left:18px;font-size:12px">${rows}</ul>` +
    `</details>`
  );
}

/** Embed pin metadata in SPB timeline Comment HTML (Frappe text/html). */
export function buildGiyaPinCommentHtml(pin: GiyaPinPayload): string {
  const bodyHtml = sanitizeCommentHtml(pin.text);
  const plain = commentHtmlToPlainText(bodyHtml) || pin.label;
  const payload = escapeAttr(
    JSON.stringify({
      ...pin,
      text: bodyHtml,
    })
  );
  const specsHtml = pin.envSpecs?.length ? buildEnvSpecsHtml(pin.envSpecs) : "";
  return (
    `<div ${MARKER}="1" data-giya-json="${payload}">` +
    `<div class="giya-comment-body">${bodyHtml}</div>` +
    `<p><small>Giya pin · <a href="${escapeAttr(pin.href)}">${escapeHtml(pin.label)}</a>` +
    (plain ? ` · ${escapeHtml(plain.slice(0, 80))}` : "") +
    `</small></p>` +
    specsHtml +
    `</div>`
  );
}

export function parseGiyaPinFromCommentHtml(content: string): GiyaPinPayload | null {
  if (!content.includes(MARKER)) return null;

  const match = content.match(/data-giya-json="([^"]+)"/);
  if (!match?.[1]) return null;

  try {
    const decoded = match[1]
      .replaceAll("&quot;", '"')
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">");
    const parsed = JSON.parse(decoded) as GiyaPinPayload;
    if (parsed?.v !== 1 || !parsed.href || !parsed.selector || !parsed.text) return null;
    return {
      ...parsed,
      text: sanitizeCommentHtml(parsed.text),
    };
  } catch {
    return null;
  }
}

export function hrefMatchesPin(pageHref: string, pinHref: string): boolean {
  try {
    const a = new URL(pageHref);
    const b = new URL(pinHref);
    return a.origin === b.origin && a.pathname === b.pathname;
  } catch {
    return pageHref.split("#")[0] === pinHref.split("#")[0];
  }
}
