import { HOST_ID } from "../constants.ts";

export type GiyaTheme = "light" | "dark";

type Rgba = { r: number; g: number; b: number; a: number };

function parseCssColor(raw: string): Rgba | null {
  const value = (raw || "").trim().toLowerCase();
  if (!value || value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const n = Number.parseInt(h.slice(0, 6), 16);
    const a =
      h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
  }

  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/
  );
  if (rgb) {
    let a = rgb[4] == null ? 1 : Number.parseFloat(rgb[4]);
    if (String(rgb[4] || "").includes("%")) a /= 100;
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: Number.isFinite(a) ? a : 1,
    };
  }

  return null;
}

function luminance({ r, g, b }: Rgba): number {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

function bgOf(el: Element | null): Rgba | null {
  if (!el) return null;
  try {
    return parseCssColor(getComputedStyle(el).backgroundColor);
  } catch {
    return null;
  }
}

/** True when the host page reads as light (Giya should go dark for contrast). */
export function isParentPageLight(): boolean {
  const samples: Rgba[] = [];
  for (const el of [document.documentElement, document.body]) {
    const c = bgOf(el);
    if (c && c.a >= 0.2) samples.push(c);
  }

  try {
    const x = Math.floor(window.innerWidth / 2);
    const y = Math.floor(window.innerHeight / 2);
    let el = document.elementFromPoint(x, y);
    for (let i = 0; i < 6 && el; i++) {
      if (el.id !== HOST_ID && !el.closest?.(`#${HOST_ID}`)) {
        const c = bgOf(el);
        if (c && c.a >= 0.35) {
          samples.push(c);
          break;
        }
      }
      el = el.parentElement;
    }
  } catch {
    /* ignore */
  }

  if (!samples.length) {
    // No readable paint — assume light page (common for blank/login shells).
    return !window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  const avg =
    samples.reduce((sum, c) => sum + luminance(c), 0) / samples.length;
  return avg >= 0.55;
}

export function themeForParentPage(): GiyaTheme {
  return isParentPageLight() ? "dark" : "light";
}

export function applyGiyaTheme(root: HTMLElement, theme: GiyaTheme): void {
  root.dataset.giyaTheme = theme;
}

/** Keep Giya contrast-inverted vs the parent page. */
export function watchParentTheme(
  root: HTMLElement,
  onChange?: (theme: GiyaTheme) => void
): () => void {
  let last = themeForParentPage();
  applyGiyaTheme(root, last);
  onChange?.(last);

  const sync = () => {
    const next = themeForParentPage();
    if (next === last) return;
    last = next;
    applyGiyaTheme(root, next);
    onChange?.(next);
  };

  const debounced = (() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (t) clearTimeout(t);
      t = setTimeout(sync, 120);
    };
  })();

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", debounced);

  const observer = new MutationObserver(debounced);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
  }

  window.addEventListener("resize", debounced);

  return () => {
    media.removeEventListener("change", debounced);
    observer.disconnect();
    window.removeEventListener("resize", debounced);
  };
}
