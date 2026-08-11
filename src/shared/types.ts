export type FabPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

/** In-page popout views (never navigate to extension tabs). */
export type DockPanel =
  | "concerns"
  | "comment"
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
}

export interface StoredSettings {
  iconUrl: string;
  position: FabPosition;
  sidebarWidth: number;
  fabLeft: number | null;
  fabTop: number | null;
  pinned: boolean;
}
