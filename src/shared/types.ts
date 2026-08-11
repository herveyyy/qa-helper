export type FabPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

/** Giya chrome theme (independent of host page). Default: dark. */
export type GiyaTheme = "light" | "dark";

/** In-page popout views (never navigate to extension tabs). */
export type DockPanel =
  | "concerns"
  | "new-task"
  | "comment"
  | "pin"
  | "environment"
  | "login"
  | "profile"
  | null;

export interface FabCoords {
  left: number;
  top: number;
}

export interface WidgetConfig {
  iconUrl: string;
  position: FabPosition;
  sidebarWidth: number;
  fabCoords: FabCoords | null;
  pinned: boolean;
  theme: GiyaTheme;
  panelWidth: number;
  panelHeight: number;
}

export interface StoredSettings {
  iconUrl: string;
  position: FabPosition;
  sidebarWidth: number;
  fabLeft: number | null;
  fabTop: number | null;
  pinned: boolean;
  theme: GiyaTheme;
  panelWidth: number;
  panelHeight: number;
  /** Host/origin patterns where the widget may mount (e.g. `wela.dev`, `*.livro.systems`). */
  allowedOrigins: string[];
}
