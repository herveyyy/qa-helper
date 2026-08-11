import type { GiyaTheme } from "../../shared/types.ts";

export function applyGiyaTheme(root: HTMLElement, theme: GiyaTheme): void {
  root.dataset.giyaTheme = theme;
}
