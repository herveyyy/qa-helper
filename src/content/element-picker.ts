import { HOST_ID } from "./constants.ts";

export type PickedElement = {
  element: Element;
  label: string;
  selector: string;
  tagName: string;
};

type PickerCallbacks = {
  onHover: (rect: DOMRect | null, label: string | null) => void;
  onPick: (picked: PickedElement) => void;
  onCancel: () => void;
};

export class ElementPicker {
  private active = false;
  private callbacks: PickerCallbacks | null = null;
  private hovered: Element | null = null;

  get isActive(): boolean {
    return this.active;
  }

  start(callbacks: PickerCallbacks): void {
    if (this.active) this.stop();
    this.active = true;
    this.callbacks = callbacks;
    document.documentElement.classList.add("giya-picking");
    ensurePickerStyle();
    document.addEventListener("mousemove", this.onMove, true);
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("keydown", this.onKeyDown, true);
    document.addEventListener("scroll", this.onScroll, true);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.hovered = null;
    this.callbacks = null;
    document.documentElement.classList.remove("giya-picking");
    document.removeEventListener("mousemove", this.onMove, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKeyDown, true);
    document.removeEventListener("scroll", this.onScroll, true);
  }

  private onMove = (event: MouseEvent): void => {
    if (!this.active) return;
    const el = targetFromPoint(event.clientX, event.clientY);
    this.hovered = el;
    if (!el) {
      this.callbacks?.onHover(null, null);
      return;
    }
    this.callbacks?.onHover(el.getBoundingClientRect(), describeElement(el));
  };

  private onScroll = (): void => {
    if (!this.active || !this.hovered) return;
    this.callbacks?.onHover(
      this.hovered.getBoundingClientRect(),
      describeElement(this.hovered)
    );
  };

  private onClick = (event: MouseEvent): void => {
    if (!this.active) return;
    // Let clicks on the Giya dock/panel through.
    if (isGiyaUi(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const el = targetFromPoint(event.clientX, event.clientY) ?? this.hovered;
    if (!el) return;

    const picked: PickedElement = {
      element: el,
      label: describeElement(el),
      selector: cssPath(el),
      tagName: el.tagName.toLowerCase(),
    };
    const cb = this.callbacks;
    this.stop();
    cb?.onPick(picked);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    const cb = this.callbacks;
    this.stop();
    cb?.onCancel();
  };
}

const PICKER_STYLE_ID = "giya-picker-style";

function ensurePickerStyle(): void {
  if (document.getElementById(PICKER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PICKER_STYLE_ID;
  style.textContent =
    "html.giya-picking, html.giya-picking * { cursor: crosshair !important; }";
  document.documentElement.appendChild(style);
}

function isGiyaUi(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  const host = document.getElementById(HOST_ID);
  // Closed shadow retargets events to the host.
  return Boolean(host && (target === host || host.contains(target)));
}

function targetFromPoint(x: number, y: number): Element | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (el.id === HOST_ID) continue;
    if (el.closest(`#${HOST_ID}`)) continue;
    // Skip html/body for a more useful pick target when possible
    if (el === document.documentElement || el === document.body) continue;
    return el;
  }
  return document.body;
}

export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls =
    typeof el.className === "string" && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
  const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
  const suffix = text ? ` “${text}${text.length >= 40 ? "…" : ""}”` : "";
  return `${tag}${id}${cls}${suffix}`;
}

export function cssPath(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(part);
    current = parent;
    if (parts.length > 6) break;
  }

  return parts.join(" > ");
}
