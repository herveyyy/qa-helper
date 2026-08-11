import type { Concern, GiyaPinComment } from "../../lib/entities/concern.type";
import type { ExtensionSession } from "../../lib/entities/auth.type";
import type { UserProfile } from "../../lib/entities/user.type";
import {
  connectErpFromDesk,
  connectErpOtp,
  connectErpPassword,
  disconnectErp,
  fetchSession,
  fetchUserProfile,
  peekSid,
} from "./auth-client.ts";
import {
  addConcernPin,
  createConcern,
  listConcerns,
  listPagePins,
} from "./concern-client.ts";
import { HOST_ID } from "./constants.ts";
import { ElementPicker, type PickedElement } from "./element-picker.ts";
import { collectEnvSpecs } from "./env-specs.ts";
import { ICONS } from "./icons.ts";
import { isUrlAllowed } from "../shared/allowed_origins.ts";
import {
  DEFAULT_POSITION,
  DEFAULT_SIDEBAR_WIDTH,
  DOCK_WIDTH,
  DRAG_THRESHOLD_PX,
  FAB_MARGIN,
  FAB_SIZE,
  STORAGE_DEFAULTS,
  defaultIconUrl,
} from "../shared/defaults.ts";
import type { DockPanel, FabCoords, FabPosition, WidgetConfig } from "../shared/types.ts";

const iconBtnClass =
  "grid h-8 w-8 place-items-center rounded-full text-neutral-700 transition hover:bg-black/8 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 data-[active=true]:bg-black data-[active=true]:text-white";

interface WidgetElements {
  root: HTMLDivElement;
  backdrop: HTMLDivElement;
  dock: HTMLElement;
  panel: HTMLElement;
  panelHeader: HTMLElement;
  panelTitle: HTMLElement;
  panelBody: HTMLElement;
  highlight: HTMLDivElement;
  pickHint: HTMLDivElement;
  pinLayer: HTMLDivElement;
  fab: HTMLButtonElement;
  fabIcon: HTMLImageElement;
  btnBack: HTMLButtonElement;
  btnEnv: HTMLButtonElement;
  btnUser: HTMLButtonElement;
  btnPin: HTMLButtonElement;
  btnClosePanel: HTMLButtonElement;
}

async function loadConfig(): Promise<WidgetConfig> {
  const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);
  const fabLeft = stored.fabLeft;
  const fabTop = stored.fabTop;

  return {
    iconUrl: stored.iconUrl || defaultIconUrl(),
    position: (stored.position as FabPosition) || DEFAULT_POSITION,
    sidebarWidth: Number(stored.sidebarWidth) || DEFAULT_SIDEBAR_WIDTH,
    fabCoords:
      typeof fabLeft === "number" && typeof fabTop === "number"
        ? { left: fabLeft, top: fabTop }
        : null,
    pinned: Boolean(stored.pinned),
  };
}

async function loadStyles(shadow: ShadowRoot): Promise<void> {
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

function defaultCoords(position: FabPosition): FabCoords {
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

function clampCoords(coords: FabCoords): FabCoords {
  const maxLeft = Math.max(FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN);
  const maxTop = Math.max(FAB_MARGIN, window.innerHeight - FAB_SIZE - FAB_MARGIN);
  return {
    left: Math.min(maxLeft, Math.max(FAB_MARGIN, coords.left)),
    top: Math.min(maxTop, Math.max(FAB_MARGIN, coords.top)),
  };
}

function requireEl<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el as T;
}

/** Detect SPB concern id when browsing a Sprint Backlogs form. */
function concernNameFromLocation(): string | null {
  const path = decodeURIComponent(location.pathname);
  const match = path.match(/\/app\/sprint-backlogs\/(SPB-\d+)/i);
  return match?.[1] ?? null;
}

function loadingMarkup(message: string): string {
  return `
    <div class="flex items-center gap-2 py-1 text-xs text-neutral-500" role="status" aria-live="polite" aria-busy="true">
      ${ICONS.spinner}
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function setButtonBusy(
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

class FloatingWidget {
  private config: WidgetConfig;
  private open = false;
  private activePanel: DockPanel = null;
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private els: WidgetElements | null = null;
  private picker = new ElementPicker();
  private picked: PickedElement | null = null;
  private session: ExtensionSession | null = null;
  private profile: UserProfile | null = null;
  private authChecked = false;
  private anchorCommentToPick = false;
  private selectedConcern: Concern | null = null;
  private pagePins: GiyaPinComment[] = [];
  private loadingPins = false;
  private otpTmpId: string | null = null;
  private pendingLoginEmail = "";
  private keysShielded = false;
  private panelCoords: FabCoords | null = null;
  private pinsHref: string | null = null;
  private pinsReloadQueued = false;
  private drag:
    | {
      pointerId: number;
      startX: number;
      startY: number;
      originLeft: number;
      originTop: number;
      moved: boolean;
    }
    | null = null;
  private panelDrag:
    | {
      pointerId: number;
      startX: number;
      startY: number;
      originLeft: number;
      originTop: number;
      moved: boolean;
    }
    | null = null;
  private suppressClick = false;

  constructor(config: WidgetConfig) {
    this.config = config;
  }

  async mount(): Promise<void> {
    if (document.getElementById(HOST_ID)) return;

    this.host = document.createElement("div");
    this.host.id = HOST_ID;
    this.shadow = this.host.attachShadow({ mode: "closed" });
    await loadStyles(this.shadow);

    const root = document.createElement("div");
    root.className = "pointer-events-none fixed inset-0 z-[2147483646] font-sans antialiased";
    root.innerHTML = `
      <div data-backdrop class="pointer-events-auto fixed inset-0 bg-black/10 opacity-0 transition-opacity duration-200 ease-out invisible" aria-hidden="true"></div>

      <div
        data-highlight
        class="pointer-events-none fixed z-1 rounded-md border-2 border-sky-400 bg-sky-400/15 opacity-0 transition-opacity duration-75"
        hidden
      ></div>

      <div
        data-pick-hint
        class="pointer-events-none fixed bottom-4 left-1/2 z-5 -translate-x-1/2 rounded-full border border-white/50 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-150"
        hidden
      >
        Click an element to comment · Esc to cancel
      </div>

      <div data-pin-layer class="pointer-events-none fixed inset-0 z-[3]"></div>

      <div
        data-dock
        class="pointer-events-auto fixed z-3 flex flex-col items-center gap-1 rounded-full border border-white/50 bg-white/55 p-1.5 shadow-lg shadow-black/10 backdrop-blur-xl transition duration-200 ease-out scale-95 opacity-0"
        role="toolbar"
        aria-label="Giya"
        hidden
      >
        <button type="button" data-back class="${iconBtnClass}" aria-label="Back" title="Back" data-active="false">
          ${ICONS.back}
        </button>
        <button type="button" data-env class="${iconBtnClass}" aria-label="Environment" title="Environment" data-active="false">
          ${ICONS.environment}
        </button>
        <button type="button" data-user class="${iconBtnClass}" aria-label="Profile" title="Profile" data-active="false">
          ${ICONS.user}
        </button>
        <button type="button" data-pin class="${iconBtnClass}" aria-label="Pin toolbar" title="Pin toolbar" data-active="false" aria-pressed="false">
          ${ICONS.pin}
        </button>
      </div>

      <section
        data-panel
        class="pointer-events-auto fixed z-4 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/50 bg-white/70 text-neutral-900 shadow-xl shadow-black/10 backdrop-blur-2xl transition duration-200 ease-out scale-95 opacity-0"
        role="dialog"
        aria-label="Giya panel"
        hidden
      >
        <header data-panel-header class="flex cursor-grab items-center gap-2 border-b border-black/5 px-3 py-2 active:cursor-grabbing touch-none select-none">
          <h2 data-panel-title class="flex-1 text-xs font-semibold tracking-tight text-neutral-800"></h2>
          <button type="button" data-close-panel class="${iconBtnClass} cursor-pointer" aria-label="Close panel">
            ${ICONS.close}
          </button>
        </header>
        <div data-panel-body class="max-h-72 overflow-auto px-3 py-3 text-sm"></div>
      </section>

      <button
        type="button"
        data-fab
        class="pointer-events-auto fixed z-2 grid h-8 w-8 place-items-center rounded-full border border-white/40 bg-black p-0 shadow-md transition-transform duration-150 ease-out hover:scale-105 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black cursor-grab active:cursor-grabbing touch-none select-none"
        aria-label="Open Giya"
        aria-expanded="false"
      >
        <img data-fab-icon class="pointer-events-none h-4 w-4 rounded-full object-cover" alt="" draggable="false" />
      </button>
    `;

    this.shadow.appendChild(root);
    document.documentElement.appendChild(this.host);

    this.els = {
      root,
      backdrop: requireEl<HTMLDivElement>(root, "[data-backdrop]"),
      dock: requireEl<HTMLElement>(root, "[data-dock]"),
      panel: requireEl<HTMLElement>(root, "[data-panel]"),
      panelHeader: requireEl<HTMLElement>(root, "[data-panel-header]"),
      panelTitle: requireEl<HTMLElement>(root, "[data-panel-title]"),
      panelBody: requireEl<HTMLElement>(root, "[data-panel-body]"),
      highlight: requireEl<HTMLDivElement>(root, "[data-highlight]"),
      pickHint: requireEl<HTMLDivElement>(root, "[data-pick-hint]"),
      pinLayer: requireEl<HTMLDivElement>(root, "[data-pin-layer]"),
      fab: requireEl<HTMLButtonElement>(root, "[data-fab]"),
      fabIcon: requireEl<HTMLImageElement>(root, "[data-fab-icon]"),
      btnBack: requireEl<HTMLButtonElement>(root, "[data-back]"),
      btnEnv: requireEl<HTMLButtonElement>(root, "[data-env]"),
      btnUser: requireEl<HTMLButtonElement>(root, "[data-user]"),
      btnPin: requireEl<HTMLButtonElement>(root, "[data-pin]"),
      btnClosePanel: requireEl<HTMLButtonElement>(root, "[data-close-panel]"),
    };

    this.applyIcon(this.config.iconUrl);
    this.applyFabCoords(
      this.config.fabCoords
        ? clampCoords(this.config.fabCoords)
        : defaultCoords(this.config.position)
    );
    this.syncPinUi();
    this.bindEvents();
    // Desk awesomebar steals keys when focus is inside closed shadow — shield early.
    this.enableKeyShield();
    void this.refreshSession().then((ok) => {
      if (ok) void this.refreshPagePins(true);
      if (this.config.pinned && this.session) {
        this.setOpen(true);
        this.setPanel("concerns");
      }
    });
  }

  private bindEvents(): void {
    const els = this.els;
    if (!els) return;

    els.fab.addEventListener("pointerdown", this.onPointerDown);
    els.fab.addEventListener("click", this.onFabClick, true);
    els.btnBack.addEventListener("click", () => this.onBackClick());
    els.btnEnv.addEventListener("click", () => this.togglePanel("environment"));
    els.btnUser.addEventListener("click", () => this.onUserClick());
    els.btnPin.addEventListener("click", () => this.togglePin());
    els.btnClosePanel.addEventListener("click", () => this.onBackClick());
    els.panelHeader.addEventListener("pointerdown", this.onPanelPointerDown);
    els.backdrop.addEventListener("click", () => {
      if (this.picker.isActive) return;
      if (this.config.pinned && this.session) {
        this.setPanel(null);
        return;
      }
      this.setOpen(false);
    });
    window.addEventListener("resize", this.onResize);
    window.addEventListener("scroll", this.onScrollOrResize, true);
    window.addEventListener("popstate", this.onLocationMaybeChanged);
    this.patchHistoryForPins();
    try {
      chrome.runtime.onMessage.addListener((message: { type?: string }) => {
        if (!chrome.runtime?.id) return undefined;
        if (message?.type === "AUTH_CHANGED") {
          void this.refreshSession(true).then(async (ok) => {
            if (ok) {
              void this.refreshPagePins(true);
              if (this.activePanel === "login") {
                this.setPanel("concerns");
              }
              return;
            }
            this.pagePins = [];
            this.renderSavedPins();
            // Login popout only when SID cookie is gone — never on ERP timeout.
            if (this.open && this.activePanel !== "login") {
              const hasSid = await peekSid();
              if (!hasSid) this.showLoginPopout();
            }
          });
        }
        return undefined;
      });
    } catch {
      // Extension reloaded — page needs a refresh.
    }
  }

  private async refreshSession(force = false): Promise<boolean> {
    const result = await fetchSession(force);
    this.authChecked = true;
    this.session = result.ok ? result.session : null;
    if (this.session) {
      // Don't block dock/login on avatar download.
      void this.ensureProfile(force);
    } else {
      this.profile = null;
      this.pagePins = [];
      this.pinsHref = null;
      this.renderSavedPins();
    }
    return Boolean(this.session);
  }

  /** Load Livro avatar (data URL from SW so it works on any page). */
  private async ensureProfile(force = false): Promise<UserProfile | null> {
    if (
      !force &&
      this.profile?.userImage &&
      this.profile.userImage.startsWith("data:")
    ) {
      return this.profile;
    }
    const result = await fetchUserProfile();
    if (result.ok) {
      this.profile = result.profile;
      return this.profile;
    }
    return this.profile;
  }

  private avatarUrl(): string {
    return this.profile?.userImage || defaultIconUrl();
  }

  /** Require explicit Giya↔Livro connect (not silent Desk cookie). */
  private async requireSession(): Promise<boolean> {
    const connected = await peekSid();
    if (!connected) {
      this.session = null;
      this.showLoginPopout();
      return false;
    }

    const ok = await this.refreshSession(false);
    if (!ok) {
      this.showLoginPopout();
      return false;
    }
    return true;
  }

  private showLoginPopout(): void {
    if (!this.open) this.setOpen(true, { allowSignedOut: true });
    this.setPanel("login");
  }

  private onFabClick = (event: MouseEvent): void => {
    if (!this.suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.suppressClick = false;
  };

  private onPointerDown = (event: PointerEvent): void => {
    const els = this.els;
    if (!els || event.button !== 0) return;

    const fab = els.fab;
    const rect = fab.getBoundingClientRect();
    this.suppressClick = false;
    this.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      moved: false,
    };

    fab.setPointerCapture(event.pointerId);
    fab.addEventListener("pointermove", this.onPointerMove);
    fab.addEventListener("pointerup", this.onPointerUp);
    fab.addEventListener("pointercancel", this.onPointerUp);
  };

  private onPointerMove = (event: PointerEvent): void => {
    const els = this.els;
    if (!els || !this.drag || event.pointerId !== this.drag.pointerId) return;

    const dx = event.clientX - this.drag.startX;
    const dy = event.clientY - this.drag.startY;

    if (!this.drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      this.drag.moved = true;
      this.suppressClick = true;
      els.fab.classList.add("scale-105");
      els.fab.classList.remove("transition-transform");
    }

    event.preventDefault();
    this.applyFabCoords(
      clampCoords({
        left: this.drag.originLeft + dx,
        top: this.drag.originTop + dy,
      })
    );
  };

  private onPointerUp = (event: PointerEvent): void => {
    const els = this.els;
    if (!els || !this.drag || event.pointerId !== this.drag.pointerId) return;

    const { moved } = this.drag;
    els.fab.removeEventListener("pointermove", this.onPointerMove);
    els.fab.removeEventListener("pointerup", this.onPointerUp);
    els.fab.removeEventListener("pointercancel", this.onPointerUp);

    try {
      els.fab.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    els.fab.classList.add("transition-transform");
    if (!this.open) els.fab.classList.remove("scale-105");

    this.drag = null;

    if (moved) {
      this.suppressClick = true;
      if (this.config.fabCoords) {
        void chrome.storage.sync.set({
          fabLeft: this.config.fabCoords.left,
          fabTop: this.config.fabCoords.top,
        });
      }
      this.layoutChrome();
      return;
    }

    void this.toggle();
  };

  private onResize = (): void => {
    if (!this.config.fabCoords) {
      this.applyFabCoords(defaultCoords(this.config.position));
    } else {
      this.applyFabCoords(clampCoords(this.config.fabCoords));
    }
    if (this.panelCoords) {
      this.panelCoords = this.clampPanelCoords(this.panelCoords);
    }
    this.syncPinnedChrome();
  };

  private onLocationMaybeChanged = (): void => {
    if (this.pinsHref === location.href) return;
    void this.refreshPagePins(true);
  };

  private patchHistoryForPins(): void {
    const notify = () => this.onLocationMaybeChanged();
    const wrap = (method: "pushState" | "replaceState") => {
      const original = history[method].bind(history);
      history[method] = ((...args: Parameters<History["pushState"]>) => {
        const result = original(...args);
        notify();
        return result;
      }) as History["pushState"];
    };
    try {
      wrap("pushState");
      wrap("replaceState");
    } catch {
      // Some hosts freeze history; popstate still covers back/forward.
    }
  }

  private onScrollOrResize = (): void => {
    this.renderSavedPins();
    if (!this.anchorCommentToPick || !this.picked || this.activePanel !== "comment") return;
    this.syncPinnedChrome();
  };

  /** Re-layout dock/FAB; if a comment is pinned, keep pin + composer on the element. */
  private syncPinnedChrome(): void {
    this.layoutChrome();
    this.renderSavedPins();
    if (!this.anchorCommentToPick || !this.picked || this.activePanel !== "comment") return;
    if (!this.picked.element.isConnected) {
      this.setPanel(null);
      return;
    }
    const rect = this.picked.element.getBoundingClientRect();
    this.renderDraftPin(rect);
    this.layoutPinnedPopout(rect);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    if (this.picker.isActive) return; // picker owns Escape while active
    if (this.activePanel) {
      this.setPanel(null);
      return;
    }
    if (!this.config.pinned) this.setOpen(false);
  };

  /**
   * Frappe Desk routes keydowns to the navbar search when `document.activeElement`
   * is not an input. Inside a shadow root, activeElement is the host — so typing
   * in our password field lands in Awesome Bar. Stop host listeners; do not
   * preventDefault so the focused Giya field still receives the character.
   */
  private focusedGiyaField(): HTMLInputElement | HTMLTextAreaElement | null {
    const active = this.shadow?.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      return active;
    }
    return null;
  }

  private enableKeyShield(): void {
    if (this.keysShielded) return;
    this.keysShielded = true;
    window.addEventListener("keydown", this.onKeyShield, true);
    window.addEventListener("keypress", this.onKeyShield, true);
    window.addEventListener("keyup", this.onKeyShield, true);
  }

  private onKeyShield = (event: KeyboardEvent): void => {
    if (!this.focusedGiyaField()) return;
    event.stopImmediatePropagation();
    if (event.type === "keydown" && event.key === "Escape") {
      event.preventDefault();
      this.onKeyDown(event);
    }
  };

  private focusPanelField(selector: string): void {
    const els = this.els;
    if (!els) return;
    requestAnimationFrame(() => {
      const field = els.panelBody.querySelector(selector) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      field?.focus({ preventScroll: true });
    });
  }

  applyIcon(iconUrl: string): void {
    const els = this.els;
    if (!els) return;
    this.config.iconUrl = iconUrl || defaultIconUrl();
    els.fabIcon.src = this.config.iconUrl;
  }

  applyFabCoords(coords: FabCoords): void {
    const els = this.els;
    if (!els) return;
    const next = clampCoords(coords);
    this.config.fabCoords = next;
    els.fab.style.left = `${next.left}px`;
    els.fab.style.top = `${next.top}px`;
    els.fab.style.right = "auto";
    els.fab.style.bottom = "auto";
    this.layoutChrome();
  }

  applyPosition(position: FabPosition): void {
    this.config.position = position || DEFAULT_POSITION;
    if (!this.config.fabCoords) {
      this.applyFabCoords(defaultCoords(this.config.position));
    }
  }

  applySidebarWidth(_width: number): void {
    // Kept for storage sync compatibility; glass dock is fixed-width.
  }

  private clampPanelCoords(coords: FabCoords): FabCoords {
    const els = this.els;
    const panelWidth = Math.min(288, window.innerWidth - FAB_MARGIN * 2);
    const panelHeight = els?.panel.offsetHeight || 240;
    const maxLeft = Math.max(FAB_MARGIN, window.innerWidth - panelWidth - FAB_MARGIN);
    const maxTop = Math.max(FAB_MARGIN, window.innerHeight - panelHeight - FAB_MARGIN);
    return {
      left: Math.min(maxLeft, Math.max(FAB_MARGIN, coords.left)),
      top: Math.min(maxTop, Math.max(FAB_MARGIN, coords.top)),
    };
  }

  private defaultPanelCoords(): FabCoords {
    const coords = this.config.fabCoords || defaultCoords(this.config.position);
    const panelWidth = Math.min(288, window.innerWidth - FAB_MARGIN * 2);
    let left = coords.left - panelWidth - 12;
    if (left < FAB_MARGIN) left = coords.left + FAB_SIZE + 12;
    return this.clampPanelCoords({ left, top: Math.max(FAB_MARGIN, coords.top - 40) });
  }

  private applyPanelCoords(coords: FabCoords): void {
    const els = this.els;
    if (!els) return;
    const next = this.clampPanelCoords(coords);
    this.panelCoords = next;
    const panelWidth = Math.min(288, window.innerWidth - FAB_MARGIN * 2);
    els.panel.style.left = `${next.left}px`;
    els.panel.style.top = `${next.top}px`;
    els.panel.style.width = `${panelWidth}px`;
  }

  private layoutChrome(): void {
    const els = this.els;
    const coords = this.config.fabCoords;
    if (!els || !coords) return;

    const dockLeft = Math.min(
      Math.max(FAB_MARGIN, coords.left + FAB_SIZE / 2 - DOCK_WIDTH / 2),
      window.innerWidth - DOCK_WIDTH - FAB_MARGIN
    );
    const dockHeight = els.dock.offsetHeight || 48;
    let dockTop = coords.top - dockHeight - 10;
    if (dockTop < FAB_MARGIN) {
      dockTop = coords.top + FAB_SIZE + 10;
    }
    els.dock.style.left = `${dockLeft}px`;
    els.dock.style.top = `${dockTop}px`;

    // Comment composer anchors to the picked element, not free panel coords.
    if (this.anchorCommentToPick && this.picked && this.activePanel === "comment") {
      return;
    }

    this.applyPanelCoords(this.panelCoords || this.defaultPanelCoords());
  }

  private onPanelPointerDown = (event: PointerEvent): void => {
    const els = this.els;
    if (!els || event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-close-panel]")) return;
    if (this.anchorCommentToPick && this.activePanel === "comment") return;

    const rect = els.panel.getBoundingClientRect();
    this.panelDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      moved: false,
    };
    els.panelHeader.setPointerCapture(event.pointerId);
    els.panelHeader.addEventListener("pointermove", this.onPanelPointerMove);
    els.panelHeader.addEventListener("pointerup", this.onPanelPointerUp);
    els.panelHeader.addEventListener("pointercancel", this.onPanelPointerUp);
  };

  private onPanelPointerMove = (event: PointerEvent): void => {
    const els = this.els;
    if (!els || !this.panelDrag || event.pointerId !== this.panelDrag.pointerId) return;

    const dx = event.clientX - this.panelDrag.startX;
    const dy = event.clientY - this.panelDrag.startY;
    if (!this.panelDrag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      this.panelDrag.moved = true;
      els.panel.classList.remove("transition", "duration-200", "ease-out");
    }

    event.preventDefault();
    this.applyPanelCoords({
      left: this.panelDrag.originLeft + dx,
      top: this.panelDrag.originTop + dy,
    });
  };

  private onPanelPointerUp = (event: PointerEvent): void => {
    const els = this.els;
    if (!els || !this.panelDrag || event.pointerId !== this.panelDrag.pointerId) return;

    els.panelHeader.removeEventListener("pointermove", this.onPanelPointerMove);
    els.panelHeader.removeEventListener("pointerup", this.onPanelPointerUp);
    els.panelHeader.removeEventListener("pointercancel", this.onPanelPointerUp);
    try {
      els.panelHeader.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    els.panel.classList.add("transition", "duration-200", "ease-out");
    this.panelDrag = null;
  };

  async toggle(): Promise<void> {
    if (this.open) {
      this.setOpen(false);
      return;
    }

    await this.refreshSession(false);
    this.setOpen(true, { allowSignedOut: true });
    if (!this.session) {
      this.setPanel("login");
      return;
    }
    void this.refreshPagePins();
    this.setPanel("concerns");
  }

  setOpen(next: boolean, options: { allowSignedOut?: boolean } = {}): void {
    const els = this.els;
    if (!els) return;

    const wantOpen = Boolean(next);
    this.open =
      wantOpen || (this.config.pinned && Boolean(this.session));
    if (wantOpen && !this.session && !options.allowSignedOut) {
      this.showLoginPopout();
      return;
    }

    const { backdrop, dock, fab } = els;

    fab.setAttribute("aria-expanded", String(this.open));
    fab.setAttribute("aria-label", this.open ? "Close Giya" : "Open Giya");
    fab.hidden = this.open;
    fab.classList.toggle("opacity-0", this.open);

    if (this.open) {
      dock.hidden = false;
      if (!this.activePanel) {
        this.hidePanelVisual();
      }
      this.layoutChrome();
      requestAnimationFrame(() => {
        if (this.config.pinned && this.session) {
          backdrop.classList.add("invisible", "opacity-0");
          backdrop.classList.remove("opacity-100");
        } else {
          backdrop.classList.remove("invisible", "opacity-0");
          backdrop.classList.add("opacity-100");
        }
        dock.classList.remove("scale-95", "opacity-0");
        dock.classList.add("scale-100", "opacity-100");
        this.syncPinnedChrome();
      });
      document.addEventListener("keydown", this.onKeyDown);
    } else {
      this.stopPicker();
      this.clearCommentPin();
      this.setPanel(null);
      backdrop.classList.add("opacity-0");
      backdrop.classList.remove("opacity-100");
      dock.classList.add("scale-95", "opacity-0");
      dock.classList.remove("scale-100", "opacity-100");
      window.setTimeout(() => {
        if (!this.open) {
          backdrop.classList.add("invisible");
          dock.hidden = true;
        }
      }, 200);
      document.removeEventListener("keydown", this.onKeyDown);
    }
  }

  private onBackClick(): void {
    if (this.picker.isActive) {
      this.stopPicker();
      this.picked = null;
      this.clearDraftPin();
      if (this.session) {
        this.setPanel("concerns");
      } else {
        this.setOpen(false);
      }
      return;
    }

    if (this.activePanel === "comment") {
      this.clearDraftPin();
      this.picked = null;
      this.anchorCommentToPick = false;
      this.setPanel("concerns");
      return;
    }

    this.setOpen(false);
  }

  private onUserClick(): void {
    void (async () => {
      if (!(await this.requireSession())) return;
      if (this.activePanel === "profile") {
        this.setPanel(null);
        return;
      }
      this.setPanel("profile");
    })();
  }

  private togglePanel(panel: Exclude<DockPanel, null>): void {
    void (async () => {
      if (!(await this.requireSession())) return;
      if (this.picker.isActive) this.stopPicker();
      this.setPanel(this.activePanel === panel ? null : panel);
    })();
  }

  private startPicker(): void {
    const els = this.els;
    if (!els) return;

    this.activePanel = "comment";
    this.syncDockActive();
    this.hidePanelVisual();

    // Let pointer events reach the page under the backdrop.
    els.backdrop.classList.add("pointer-events-none", "invisible", "opacity-0");
    els.backdrop.classList.remove("opacity-100");

    els.pickHint.hidden = false;
    requestAnimationFrame(() => {
      els.pickHint.classList.remove("opacity-0");
      els.pickHint.classList.add("opacity-100");
    });

    this.picker.start({
      onHover: (rect, label) => this.renderHighlight(rect, label),
      onPick: (picked) => {
        this.picked = picked;
        this.clearHighlight();
        this.hidePickHint();
        this.restoreBackdrop();
        this.anchorCommentToPick = true;
        this.setPanel("comment");
      },
      onCancel: () => {
        this.picked = null;
        this.clearHighlight();
        this.hidePickHint();
        this.restoreBackdrop();
        this.clearCommentPin();
        if (this.open && this.session) {
          this.setPanel("concerns");
        } else {
          this.activePanel = null;
          this.syncDockActive();
        }
      },
    });
  }

  private stopPicker(): void {
    if (!this.picker.isActive) return;
    this.picker.stop();
    this.clearHighlight();
    this.hidePickHint();
    this.restoreBackdrop();
  }

  private restoreBackdrop(): void {
    const els = this.els;
    if (!els || !this.open) return;
    els.backdrop.classList.remove("pointer-events-none");
    if (this.config.pinned) {
      els.backdrop.classList.add("invisible", "opacity-0");
      els.backdrop.classList.remove("opacity-100");
    } else {
      els.backdrop.classList.remove("invisible", "opacity-0");
      els.backdrop.classList.add("opacity-100");
    }
  }

  private renderHighlight(rect: DOMRect | null, _label: string | null): void {
    const els = this.els;
    if (!els) return;
    if (!rect) {
      this.clearHighlight();
      return;
    }
    const pad = 2;
    els.highlight.hidden = false;
    els.highlight.style.left = `${rect.left - pad}px`;
    els.highlight.style.top = `${rect.top - pad}px`;
    els.highlight.style.width = `${rect.width + pad * 2}px`;
    els.highlight.style.height = `${rect.height + pad * 2}px`;
    els.highlight.classList.remove("opacity-0");
    els.highlight.classList.add("opacity-100");
  }

  private clearHighlight(): void {
    const els = this.els;
    if (!els) return;
    els.highlight.classList.add("opacity-0");
    els.highlight.classList.remove("opacity-100");
    els.highlight.hidden = true;
  }

  private hidePickHint(): void {
    const els = this.els;
    if (!els) return;
    els.pickHint.classList.add("opacity-0");
    els.pickHint.classList.remove("opacity-100");
    els.pickHint.hidden = true;
  }

  private hidePanelVisual(): void {
    const els = this.els;
    if (!els) return;
    els.panel.classList.add("scale-95", "opacity-0");
    els.panel.hidden = true;
  }

  private syncDockActive(): void {
    const els = this.els;
    if (!els) return;
    els.btnBack.dataset.active = String(
      this.activePanel === "comment" ||
        this.activePanel === "concerns" ||
        this.picker.isActive
    );
    els.btnEnv.dataset.active = String(this.activePanel === "environment");
    els.btnUser.dataset.active = String(this.activePanel === "profile");
  }

  private setPanel(panel: DockPanel): void {
    const els = this.els;
    if (!els) return;

    if (!panel) {
      this.stopPicker();
      this.activePanel = null;
      this.picked = null;
      this.anchorCommentToPick = false;
      this.syncDockActive();
      this.hidePanelVisual();
      this.clearDraftPin();
      this.renderSavedPins();
      return;
    }

    if (panel !== "comment") {
      this.stopPicker();
      this.clearDraftPin();
      this.anchorCommentToPick = false;
    }

    this.activePanel = panel;
    this.syncDockActive();

    if (panel === "login") {
      this.renderLoginPanel();
    } else if (panel === "profile") {
      void this.renderProfilePanel();
      return;
    } else if (panel === "concerns") {
      void this.renderConcernsPanel();
      return;
    } else if (panel === "comment") {
      if (!this.selectedConcern) {
        void this.renderConcernsPanel();
        return;
      }
      if (!this.picked) {
        this.startPicker();
        return;
      }
      this.renderCommentPanel(this.picked);
    } else {
      els.panelTitle.textContent = "Environment";
      const specs = collectEnvSpecs();
      els.panelBody.innerHTML = `
        <dl class="space-y-2.5">
          ${specs
            .map(
              (s) => `
            <div>
              <dt class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">${escapeHtml(s.label)}</dt>
              <dd class="break-all text-xs leading-snug text-neutral-800">${escapeHtml(s.value)}</dd>
            </div>`
            )
            .join("")}
        </dl>
      `;
    }

    this.showPanelVisual();
  }

  private showPanelVisual(): void {
    const els = this.els;
    if (!els) return;
    els.panel.hidden = false;
    if (this.anchorCommentToPick && this.picked) {
      this.layoutPinnedPopout(this.picked.element.getBoundingClientRect());
    } else {
      this.layoutChrome();
    }
    requestAnimationFrame(() => {
      els.panel.classList.remove("scale-95", "opacity-0");
      els.panel.classList.add("scale-100", "opacity-100");
      if (this.anchorCommentToPick && this.picked) {
        this.layoutPinnedPopout(this.picked.element.getBoundingClientRect());
      } else {
        this.layoutChrome();
      }
    });
  }

  private renderLoginPanel(): void {
    const els = this.els;
    if (!els) return;

    els.panelTitle.textContent = "Connect Livro";
    const otpMode = Boolean(this.otpTmpId);

    els.panelBody.innerHTML = otpMode
      ? `
      <div class="space-y-3">
        <p class="text-xs leading-relaxed text-neutral-600">
          Enter the verification code sent to your email (same as Giya AI / Desk OTP).
        </p>
        <input
          data-otp
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="Verification code"
          class="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <button
          type="button"
          data-submit-otp
          class="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-neutral-800"
        >
          ${ICONS.login}
          Verify &amp; connect
        </button>
        <button type="button" data-back-login class="w-full text-xs font-medium text-sky-700 hover:text-sky-900">
          Back to email / password
        </button>
        <p data-auth-status class="text-xs text-neutral-500"></p>
      </div>`
      : `
      <div class="space-y-3">
        <p class="text-xs leading-relaxed text-neutral-600">
          Connect Giya to Livro with your ERP login (explicit session — not silent cookie reuse).
        </p>
        <input
          data-email
          type="email"
          autocomplete="username"
          placeholder="Email"
          class="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <input
          data-password
          type="password"
          autocomplete="current-password"
          placeholder="Password"
          class="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <button
          type="button"
          data-submit-login
          class="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-neutral-800"
        >
          ${ICONS.login}
          Connect Livro
        </button>
        <button
          type="button"
          data-connect-desk
          class="w-full rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-medium text-neutral-800 transition hover:bg-white"
        >
          Use current Desk session
        </button>
        <p data-auth-status class="text-xs text-neutral-500">Same flow as Giya AI ERP connection.</p>
      </div>`;

    const status = els.panelBody.querySelector("[data-auth-status]");
    this.focusPanelField(otpMode ? "[data-otp]" : "[data-password]");

    els.panelBody.querySelector("[data-back-login]")?.addEventListener("click", () => {
      this.otpTmpId = null;
      this.renderLoginPanel();
    });

    const submitLogin = els.panelBody.querySelector(
      "[data-submit-login]"
    ) as HTMLButtonElement | null;
    submitLogin?.addEventListener("click", () => {
      void (async () => {
        const email =
          (els.panelBody.querySelector("[data-email]") as HTMLInputElement | null)?.value.trim() ||
          "";
        const pwd =
          (els.panelBody.querySelector("[data-password]") as HTMLInputElement | null)?.value || "";
        if (!email || !pwd) {
          if (status) status.textContent = "Email and password are required.";
          return;
        }
        this.pendingLoginEmail = email;
        if (status) status.innerHTML = loadingMarkup("Connecting to Livro…");
        setButtonBusy(submitLogin, true, `${ICONS.login} Connect Livro`);
        const result = await connectErpPassword(email, pwd);
        setButtonBusy(submitLogin, false, `${ICONS.login} Connect Livro`);
        if (!result.ok) {
          if (status) status.textContent = result.error;
          return;
        }
        if (result.needsOtp) {
          this.otpTmpId = result.tmpId;
          this.renderLoginPanel();
          const nextStatus = this.els?.panelBody.querySelector("[data-auth-status]");
          if (nextStatus) nextStatus.textContent = result.prompt;
          return;
        }
        const ok = await this.refreshSession(true);
        if (!ok) {
          if (status) status.textContent = "Connected but session not ready. Retry.";
          return;
        }
        void this.refreshPagePins(true);
        this.setPanel("concerns");
      })();
    });

    const submitOtp = els.panelBody.querySelector(
      "[data-submit-otp]"
    ) as HTMLButtonElement | null;
    submitOtp?.addEventListener("click", () => {
      void (async () => {
        const otp =
          (els.panelBody.querySelector("[data-otp]") as HTMLInputElement | null)?.value.trim() ||
          "";
        if (!this.otpTmpId || !otp) {
          if (status) status.textContent = "Enter the verification code.";
          return;
        }
        if (status) status.innerHTML = loadingMarkup("Verifying…");
        setButtonBusy(submitOtp, true, `${ICONS.login} Verify & connect`);
        const result = await connectErpOtp(this.otpTmpId, otp, this.pendingLoginEmail);
        setButtonBusy(submitOtp, false, `${ICONS.login} Verify & connect`);
        if (!result.ok) {
          if (status) status.textContent = result.error;
          return;
        }
        this.otpTmpId = null;
        const ok = await this.refreshSession(true);
        if (!ok) {
          if (status) status.textContent = "Connected but session not ready. Retry.";
          return;
        }
        void this.refreshPagePins(true);
        this.setPanel("concerns");
      })();
    });

    const deskBtn = els.panelBody.querySelector(
      "[data-connect-desk]"
    ) as HTMLButtonElement | null;
    deskBtn?.addEventListener("click", () => {
      void (async () => {
        if (status) status.innerHTML = loadingMarkup("Linking Desk SID…");
        setButtonBusy(deskBtn, true, "Use current Desk session");
        const result = await connectErpFromDesk();
        setButtonBusy(deskBtn, false, "Use current Desk session");
        if (!result.ok) {
          if (status) status.textContent = result.error;
          return;
        }
        const ok = await this.refreshSession(true);
        if (!ok) {
          if (status) status.textContent = "Connected but session not ready. Retry.";
          return;
        }
        void this.refreshPagePins(true);
        this.setPanel("concerns");
      })();
    });
  }

  private async renderProfilePanel(): Promise<void> {
    const els = this.els;
    if (!els) return;

    els.panelTitle.textContent = "Profile";
    els.panelBody.innerHTML = loadingMarkup("Loading profile…");
    this.showPanelVisual();

    const profile = await this.ensureProfile(true);
    if (!profile) {
      els.panelBody.innerHTML = `<p class="text-xs text-neutral-600">Could not load profile.</p>`;
      return;
    }

    const p = profile;
    const avatar = this.avatarUrl();
    els.panelBody.innerHTML = `
      <div class="flex flex-col items-center gap-3 text-center">
        <img src="${escapeHtml(avatar)}" alt="" class="h-16 w-16 rounded-full object-cover shadow-md ring-2 ring-white" />
        <div>
          <p class="text-sm font-semibold text-neutral-900">${escapeHtml(p.fullName)}</p>
          <p class="mt-0.5 break-all text-xs text-neutral-500">${escapeHtml(p.email)}</p>
        </div>
        <p class="w-full break-all rounded-xl border border-black/5 bg-white/50 px-2.5 py-2 text-left font-mono text-[10px] text-neutral-500">
          ${escapeHtml(p.userName)}
        </p>
        <button
          type="button"
          data-disconnect
          class="w-full rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-medium text-neutral-800 transition hover:bg-white"
        >
          Disconnect Livro
        </button>
      </div>
    `;
    const img = els.panelBody.querySelector("img");
    if (img) {
      img.onerror = () => {
        img.src = defaultIconUrl();
      };
    }
    els.panelBody.querySelector("[data-disconnect]")?.addEventListener("click", () => {
      void (async () => {
        await disconnectErp();
        this.session = null;
        this.profile = null;
        this.pagePins = [];
        this.renderSavedPins();
        this.showLoginPopout();
      })();
    });
  }

  private async renderConcernsPanel(): Promise<void> {
    const els = this.els;
    if (!els) return;

    this.activePanel = "concerns";
    this.syncDockActive();
    els.panelTitle.textContent = "Concerns";
    els.panelBody.innerHTML = loadingMarkup("Loading concerns…");
    this.showPanelVisual();

    const result = await listConcerns();
    if (!result.ok) {
      els.panelBody.innerHTML = `
        <div class="space-y-3">
          <p class="text-xs leading-relaxed text-neutral-600">${escapeHtml(result.error)}</p>
          <button
            type="button"
            data-retry-concerns
            class="flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-medium text-neutral-800 transition hover:bg-white"
          >
            Retry
          </button>
        </div>
      `;
      const retry = els.panelBody.querySelector(
        "[data-retry-concerns]"
      ) as HTMLButtonElement | null;
      retry?.addEventListener("click", () => {
        void this.renderConcernsPanel();
      });
      return;
    }

    const onForm = concernNameFromLocation();
    if (onForm) {
      const match = result.concerns.find((c) => c.name === onForm);
      if (match) {
        this.selectedConcern = match;
        this.picked = null;
        this.startPicker();
        return;
      }
    }

    const sprintLabel = result.concerns[0]?.sprintAssign || "latest sprint";
    const listMarkup =
      result.concerns.length === 0
        ? `<p class="text-xs leading-relaxed text-neutral-600">
            No open concerns yet. Create one below for QA on this page.
          </p>`
        : `
      <p class="mb-2 text-xs text-neutral-500">
        ${escapeHtml(sprintLabel)} · current assignee. Pick a concern, then pin a UI element.
      </p>
      <ul class="space-y-1.5">
        ${result.concerns
          .map(
            (c) => `
          <li>
            <button
              type="button"
              data-concern="${escapeHtml(c.name)}"
              class="w-full rounded-xl border border-black/8 bg-white/60 px-2.5 py-2 text-left transition hover:bg-white"
            >
              <p class="font-mono text-[10px] font-semibold text-sky-700">${escapeHtml(c.name)}</p>
              <p class="mt-0.5 line-clamp-2 text-xs font-medium text-neutral-900">${escapeHtml(c.subject)}</p>
              <p class="mt-1 text-[10px] text-neutral-500">${escapeHtml(c.type)} · ${escapeHtml(c.status)}${c.sprintAssign ? ` · ${escapeHtml(c.sprintAssign)}` : ""}</p>
            </button>
          </li>`
          )
          .join("")}
      </ul>`;

    els.panelBody.innerHTML = `
      <div class="mb-3 space-y-2 rounded-xl border border-black/8 bg-white/50 p-2.5">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Quick SPB</p>
        <input
          type="text"
          data-create-subject
          placeholder="Subject (e.g. QA: pin misaligned on …)"
          class="w-full rounded-lg border border-black/10 bg-white/70 px-2.5 py-1.5 text-xs text-neutral-900 outline-none ring-neutral-900 placeholder:text-neutral-400 focus:ring-2"
        />
        <div class="flex gap-2">
          <select
            data-create-type
            class="min-w-0 flex-1 rounded-lg border border-black/10 bg-white/70 px-2 py-1.5 text-xs text-neutral-800 outline-none ring-neutral-900 focus:ring-2"
          >
            <option value="Bugs/Issues" selected>Bugs/Issues</option>
            <option value="Feature Request">Feature Request</option>
          </select>
          <button
            type="button"
            data-create-spb
            class="shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600"
          >
            Create
          </button>
        </div>
        <p data-create-status class="min-h-4 text-[10px] text-neutral-500"></p>
      </div>
      ${listMarkup}
    `;

    const subjectInput = els.panelBody.querySelector(
      "[data-create-subject]"
    ) as HTMLInputElement | null;
    const typeSelect = els.panelBody.querySelector(
      "[data-create-type]"
    ) as HTMLSelectElement | null;
    const createBtn = els.panelBody.querySelector(
      "[data-create-spb]"
    ) as HTMLButtonElement | null;
    const createStatus = els.panelBody.querySelector(
      "[data-create-status]"
    ) as HTMLParagraphElement | null;

    const runCreate = () => {
      void (async () => {
        const subject = subjectInput?.value.trim() || "";
        if (!subject) {
          if (createStatus) createStatus.textContent = "Enter a subject.";
          return;
        }
        if (createBtn) createBtn.disabled = true;
        if (createStatus) createStatus.textContent = "Creating…";
        const created = await createConcern({
          subject,
          type: typeSelect?.value || "Bugs/Issues",
          description: `<p>Created from Giya on <a href="${escapeHtml(location.href)}">${escapeHtml(location.href)}</a></p>`,
        });
        if (!created.ok) {
          if (createStatus) createStatus.textContent = created.error;
          if (createBtn) createBtn.disabled = false;
          return;
        }
        this.selectedConcern = created.concern;
        this.picked = null;
        this.startPicker();
      })();
    };

    createBtn?.addEventListener("click", runCreate);
    subjectInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runCreate();
      }
    });

    for (const btn of els.panelBody.querySelectorAll<HTMLButtonElement>("[data-concern]")) {
      btn.addEventListener("click", () => {
        const name = btn.dataset.concern;
        const concern = result.concerns.find((c) => c.name === name) || null;
        if (!concern) return;
        this.selectedConcern = concern;
        this.picked = null;
        this.startPicker();
      });
    }
  }

  private renderCommentPanel(picked: PickedElement): void {
    const els = this.els;
    if (!els || !this.selectedConcern) return;

    const concern = this.selectedConcern;
    const rect = picked.element.getBoundingClientRect();
    this.renderDraftPin(rect);

    els.panelTitle.textContent = "Comment";
    els.panelBody.innerHTML = `
      <div class="space-y-3">
        <div class="rounded-xl border border-black/8 bg-white/50 px-2.5 py-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Concern</p>
          <p class="mt-0.5 font-mono text-[10px] font-semibold text-sky-700">${escapeHtml(concern.name)}</p>
          <p class="mt-0.5 line-clamp-2 text-xs font-medium text-neutral-900">${escapeHtml(concern.subject)}</p>
          <button type="button" data-change-concern class="mt-2 text-xs font-medium text-sky-700 hover:text-sky-900">
            Change concern
          </button>
        </div>
        <div class="rounded-xl border border-black/8 bg-white/50 px-2.5 py-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Pinned to</p>
          <p class="mt-0.5 break-all text-xs font-medium text-neutral-900">${escapeHtml(picked.label)}</p>
          <button type="button" data-retarget class="mt-2 text-xs font-medium text-sky-700 hover:text-sky-900">
            Change element
          </button>
        </div>
        <textarea
          data-comment-input
          rows="3"
          placeholder="Comment here…"
          class="w-full resize-none rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm text-neutral-800 outline-none ring-neutral-900 placeholder:text-neutral-400 focus:ring-2"
        ></textarea>
        <div class="flex items-center justify-between gap-2">
          <p data-comment-status class="text-xs text-neutral-500">Saves to SPB with system specs. Assignees with Giya see the pin.</p>
          <button
            type="button"
            data-comment-submit
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-white shadow-md transition hover:bg-sky-600"
            aria-label="Send comment"
          >
            ${ICONS.send}
          </button>
        </div>
      </div>
    `;

    const submit = els.panelBody.querySelector("[data-comment-submit]");
    const input = els.panelBody.querySelector("[data-comment-input]") as HTMLTextAreaElement | null;
    const status = els.panelBody.querySelector("[data-comment-status]");

    els.panelBody.querySelector("[data-change-concern]")?.addEventListener("click", () => {
      this.picked = null;
      this.clearDraftPin();
      void this.renderConcernsPanel();
    });

    els.panelBody.querySelector("[data-retarget]")?.addEventListener("click", () => {
      this.picked = null;
      this.clearDraftPin();
      this.startPicker();
    });

    const submitBtn = submit as HTMLButtonElement | null;
    const sendIdle = ICONS.send;
    submitBtn?.addEventListener("click", () => {
      void (async () => {
        const text = input?.value.trim() ?? "";
        if (!text) {
          if (status) status.textContent = "Write something first.";
          return;
        }
        if (status) status.innerHTML = loadingMarkup("Saving to Livro…");
        setButtonBusy(submitBtn, true, sendIdle);
        if (input) input.disabled = true;

        const result = await addConcernPin(concern.name, {
          v: 1,
          href: location.href,
          selector: picked.selector,
          label: picked.label,
          tagName: picked.tagName,
          text,
          envSpecs: collectEnvSpecs(),
        });

        if (!result.ok) {
          setButtonBusy(submitBtn, false, sendIdle);
          if (input) input.disabled = false;
          if (status) status.textContent = result.error;
          return;
        }

        if (input) input.value = "";
        if (status) status.innerHTML = loadingMarkup("Refreshing pins…");
        this.picked = null;
        this.anchorCommentToPick = false;
        this.clearDraftPin();
        await this.refreshPagePins(true);
        this.hidePanelVisual();
        this.activePanel = null;
        this.syncDockActive();
      })();
    });
  }

  private async refreshPagePins(force = false): Promise<void> {
    if (!this.session) {
      this.pagePins = [];
      this.pinsHref = null;
      this.loadingPins = false;
      this.pinsReloadQueued = false;
      this.renderSavedPins();
      return;
    }

    if (this.loadingPins) {
      this.pinsReloadQueued = true;
      return;
    }

    if (!force && this.pinsHref === location.href) {
      // Same URL already fetched — only re-layout markers.
      this.renderSavedPins();
      return;
    }

    this.loadingPins = true;
    this.renderPinLoadingBadge(true);
    const href = location.href;
    try {
      const result = await listPagePins(href);
      this.pinsHref = href;
      this.pagePins = result.ok ? result.pins : [];
      this.renderSavedPins();
    } finally {
      this.loadingPins = false;
      this.renderPinLoadingBadge(false);
      if (this.pinsReloadQueued || this.pinsHref !== location.href) {
        this.pinsReloadQueued = false;
        void this.refreshPagePins(true);
      }
    }
  }

  private renderPinLoadingBadge(show: boolean): void {
    const els = this.els;
    if (!els) return;
    els.pinLayer.querySelector("[data-pin-loading]")?.remove();
    if (!show) return;

    const badge = document.createElement("div");
    badge.dataset.pinLoading = "1";
    badge.className =
      "pointer-events-none fixed bottom-4 right-4 z-[5] flex items-center gap-2 rounded-full border border-white/50 bg-white/80 px-3 py-1.5 text-xs text-neutral-600 shadow-md backdrop-blur-md";
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-live", "polite");
    badge.innerHTML = `${ICONS.spinner}<span>Loading pins…</span>`;
    els.pinLayer.appendChild(badge);
  }

  private renderSavedPins(): void {
    const els = this.els;
    if (!els) return;

    for (const node of els.pinLayer.querySelectorAll("[data-saved-pin]")) {
      node.remove();
    }

    for (const item of this.pagePins) {
      let target: Element | null = null;
      try {
        target = document.querySelector(item.pin.selector);
      } catch {
        target = null;
      }
      if (!target) continue;

      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 && rect.height <= 0) continue;

      const pin = document.createElement("div");
      pin.dataset.savedPin = item.commentName;
      pin.className = "pointer-events-auto absolute";
      pin.style.left = `${rect.left}px`;
      pin.style.top = `${Math.max(8, rect.top - 8)}px`;
      pin.title = `${item.concernName}: ${item.pin.text}`;
      const avatar =
        item.commentEmail === this.profile?.email || item.commentEmail === this.profile?.userName
          ? this.avatarUrl()
          : defaultIconUrl();
      pin.innerHTML = `
        <button type="button" class="relative h-8 w-8" aria-label="Open pin comment">
          <img src="${escapeHtml(avatar)}" alt="" class="h-8 w-8 rounded-full object-cover shadow-lg ring-2 ring-sky-400" />
        </button>
      `;
      const img = pin.querySelector("img");
      if (img) {
        img.onerror = () => {
          img.src = defaultIconUrl();
        };
      }
      pin.querySelector("button")?.addEventListener("click", () => {
        this.showSavedPinPopout(item);
      });
      els.pinLayer.appendChild(pin);
    }
  }

  private showSavedPinPopout(item: GiyaPinComment): void {
    const els = this.els;
    if (!els) return;

    this.activePanel = "comment";
    this.anchorCommentToPick = false;
    this.syncDockActive();
    els.panelTitle.textContent = item.concernName;
    els.panelBody.innerHTML = `
      <div class="space-y-2">
        <p class="text-xs font-medium text-neutral-900">${escapeHtml(item.concernSubject)}</p>
        <p class="text-xs text-neutral-500">${escapeHtml(item.commentBy)}</p>
        <p class="rounded-xl border border-black/8 bg-white/60 px-2.5 py-2 text-sm text-neutral-800">${escapeHtml(item.pin.text)}</p>
        <p class="break-all text-[10px] text-neutral-500">${escapeHtml(item.pin.label)}</p>
      </div>
    `;
    this.showPanelVisual();
  }

  private renderDraftPin(rect: DOMRect): void {
    const els = this.els;
    if (!els) return;

    this.clearDraftPin();
    const avatar = this.avatarUrl();
    const wrap = document.createElement("div");
    wrap.dataset.draftPin = "1";
    wrap.className = "pointer-events-auto absolute";
    wrap.style.left = `${rect.left}px`;
    wrap.style.top = `${Math.max(8, rect.top - 8)}px`;
    wrap.innerHTML = `
      <div class="relative h-8 w-8">
        <img
          src="${escapeHtml(avatar)}"
          alt=""
          class="h-8 w-8 rounded-full object-cover shadow-lg ring-2 ring-white"
        />
        <span class="absolute -right-1 -bottom-1 grid h-4 w-4 place-items-center rounded-full bg-sky-500 text-[10px] font-bold leading-none text-white ring-2 ring-white">+</span>
      </div>
    `;
    const img = wrap.querySelector("img");
    if (img) {
      img.onerror = () => {
        img.src = defaultIconUrl();
      };
    }
    els.pinLayer.appendChild(wrap);
  }

  private clearDraftPin(): void {
    const els = this.els;
    if (!els) return;
    els.pinLayer.querySelector("[data-draft-pin]")?.remove();
  }

  private clearCommentPin(): void {
    this.clearDraftPin();
  }

  private layoutPinnedPopout(rect: DOMRect): void {
    const els = this.els;
    if (!els) return;

    const panelWidth = Math.min(300, window.innerWidth - FAB_MARGIN * 2);
    let left = rect.left + 28;
    let top = rect.top + 12;

    if (left + panelWidth > window.innerWidth - FAB_MARGIN) {
      left = Math.max(FAB_MARGIN, rect.left - panelWidth - 12);
    }
    const panelHeight = els.panel.offsetHeight || 260;
    if (top + panelHeight > window.innerHeight - FAB_MARGIN) {
      top = Math.max(FAB_MARGIN, window.innerHeight - panelHeight - FAB_MARGIN);
    }

    els.panel.style.left = `${left}px`;
    els.panel.style.top = `${top}px`;
    els.panel.style.width = `${panelWidth}px`;
  }

  private togglePin(): void {
    void (async () => {
      if (!(await this.requireSession())) return;
      this.togglePinUnlocked();
    })();
  }

  private togglePinUnlocked(): void {
    this.config.pinned = !this.config.pinned;
    void chrome.storage.sync.set({ pinned: this.config.pinned });
    this.syncPinUi();
    if (this.config.pinned) {
      this.setOpen(true);
    } else if (this.open) {
      const els = this.els;
      if (els) {
        els.backdrop.classList.remove("invisible", "opacity-0");
        els.backdrop.classList.add("opacity-100");
      }
    }
  }

  private syncPinUi(): void {
    const els = this.els;
    if (!els) return;
    els.btnPin.dataset.active = String(this.config.pinned);
    els.btnPin.setAttribute("aria-pressed", String(this.config.pinned));
    els.btnPin.title = this.config.pinned ? "Unpin toolbar" : "Pin toolbar";
    els.btnPin.setAttribute(
      "aria-label",
      this.config.pinned ? "Unpin toolbar" : "Pin toolbar"
    );
  }

  updateFromStorage(changes: { [key: string]: chrome.storage.StorageChange }): void {
    if (changes.iconUrl) {
      this.applyIcon(changes.iconUrl.newValue || defaultIconUrl());
    }
    if (changes.position) {
      this.applyPosition(changes.position.newValue as FabPosition);
    }
    if (changes.sidebarWidth) {
      this.applySidebarWidth(Number(changes.sidebarWidth.newValue));
    }
    if (changes.pinned) {
      this.config.pinned = Boolean(changes.pinned.newValue);
      this.syncPinUi();
      if (this.config.pinned && this.session) this.setOpen(true);
    }
    if (changes.fabLeft || changes.fabTop) {
      const left =
        changes.fabLeft?.newValue ?? this.config.fabCoords?.left ?? defaultCoords(this.config.position).left;
      const top =
        changes.fabTop?.newValue ?? this.config.fabCoords?.top ?? defaultCoords(this.config.position).top;
      if (typeof left === "number" && typeof top === "number") {
        this.applyFabCoords({ left, top });
      }
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function boot(): Promise<void> {
  // After reload/update, old content scripts die — skip instead of crashing the page.
  try {
    if (!chrome.runtime?.id) return;
  } catch {
    return;
  }

  const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);
  const allowed =
    Array.isArray(stored.allowedOrigins) && stored.allowedOrigins.length > 0
      ? (stored.allowedOrigins as string[])
      : STORAGE_DEFAULTS.allowedOrigins;
  if (!isUrlAllowed(location.href, allowed)) return;

  const config = await loadConfig();
  const widget = new FloatingWidget(config);
  await widget.mount();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (!chrome.runtime?.id || area !== "sync") return;
    if (changes.allowedOrigins) {
      const next = Array.isArray(changes.allowedOrigins.newValue)
        ? (changes.allowedOrigins.newValue as string[])
        : STORAGE_DEFAULTS.allowedOrigins;
      if (!isUrlAllowed(location.href, next)) {
        document.getElementById(HOST_ID)?.remove();
        return;
      }
    }
    widget.updateFromStorage(changes);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void boot();
  }, { once: true });
} else {
  void boot();
}
