import { ICONS } from "../icons.ts";
import {
  DEFAULT_POSITION,
  DEFAULT_SIDEBAR_WIDTH,
  FAB_MARGIN,
  FAB_SIZE,
  STORAGE_DEFAULTS,
  defaultIconUrl,
} from "../../shared/defaults.ts";
import type { FabCoords, FabPosition, GiyaTheme, WidgetConfig } from "../../shared/types.ts";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function loadingMarkup(message: string): string {
  return `
    <div class="flex items-center gap-2 py-1 text-xs text-neutral-500" role="status" aria-live="polite" aria-busy="true">
      ${ICONS.spinner}
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

export function setButtonBusy(
  button: HTMLButtonElement | null,
  busy: boolean,
  idleHtml: string
): void {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.classList.toggle("opacity-70", busy);
  button.classList.toggle("pointer-events-none", busy);
  button.innerHTML = busy ? ICONS.spinner : idleHtml;
}

export function requireEl<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el as T;
}

export async function loadConfig(): Promise<WidgetConfig> {
  const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);
  const fabLeft = stored.fabLeft;
  const fabTop = stored.fabTop;

  const theme =
    stored.theme === "light" || stored.theme === "dark"
      ? (stored.theme as GiyaTheme)
      : "dark";

  return {
    iconUrl: stored.iconUrl || defaultIconUrl(),
    position: (stored.position as FabPosition) || DEFAULT_POSITION,
    sidebarWidth: Number(stored.sidebarWidth) || DEFAULT_SIDEBAR_WIDTH,
    fabCoords:
      typeof fabLeft === "number" && typeof fabTop === "number"
        ? { left: fabLeft, top: fabTop }
        : null,
    pinned: Boolean(stored.pinned),
    theme,
  };
}

export async function loadStyles(shadow: ShadowRoot): Promise<void> {
  const href = chrome.runtime.getURL("content/widget.css");
  try {
    const res = await fetch(href);
    const css = await res.text();
    const style = document.createElement("style");
    style.textContent = css;
    shadow.appendChild(style);
  } catch {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    shadow.appendChild(link);
  }
}

export function defaultCoords(position: FabPosition): FabCoords {
  const maxLeft = Math.max(FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN);
  const maxTop = Math.max(FAB_MARGIN, window.innerHeight - FAB_SIZE - FAB_MARGIN);

  switch (position) {
    case "bottom-left":
      return { left: FAB_MARGIN, top: maxTop };
    case "top-right":
      return { left: maxLeft, top: FAB_MARGIN };
    case "top-left":
      return { left: FAB_MARGIN, top: FAB_MARGIN };
    case "bottom-right":
    default:
      return { left: maxLeft, top: maxTop };
  }
}

export function clampCoords(coords: FabCoords): FabCoords {
  const maxLeft = Math.max(FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN);
  const maxTop = Math.max(FAB_MARGIN, window.innerHeight - FAB_SIZE - FAB_MARGIN);
  return {
    left: Math.min(maxLeft, Math.max(FAB_MARGIN, coords.left)),
    top: Math.min(maxTop, Math.max(FAB_MARGIN, coords.top)),
  };
}

/** Detect SPB concern id when browsing a Sprint Backlogs form. */
export function concernNameFromLocation(): string | null {
  const path = decodeURIComponent(location.pathname);
  const match = path.match(/\/app\/sprint-backlogs\/(SPB-\d+)/i);
  return match?.[1] ?? null;
}
