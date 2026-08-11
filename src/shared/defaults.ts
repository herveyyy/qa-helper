import type { FabPosition, StoredSettings } from "./types.ts";

export const DEFAULT_POSITION: FabPosition = "bottom-right";
export const DEFAULT_SIDEBAR_WIDTH = 360;
export const DEFAULT_PANEL_WIDTH = 380;
export const DEFAULT_PANEL_HEIGHT = 440;
export const MIN_PANEL_WIDTH = 280;
export const MIN_PANEL_HEIGHT = 240;
export const FAB_SIZE = 32;
export const DOCK_WIDTH = 44;
export const FAB_MARGIN = 16;
export const DRAG_THRESHOLD_PX = 4;

export const DEFAULT_ALLOWED_ORIGINS = ["wela.dev"];

export const STORAGE_DEFAULTS: StoredSettings = {
  iconUrl: "",
  position: DEFAULT_POSITION,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  fabLeft: null,
  fabTop: null,
  pinned: false,
  theme: "dark",
  panelWidth: DEFAULT_PANEL_WIDTH,
  panelHeight: DEFAULT_PANEL_HEIGHT,
  allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
};

export function defaultIconUrl(): string {
  return chrome.runtime.getURL("assets/giya-icon.png");
}
