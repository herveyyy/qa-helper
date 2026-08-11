import type { Concern, GiyaPinComment } from "../../../lib/entities/concern.type";
import type { ExtensionSession } from "../../../lib/entities/auth.type";
import type { UserProfile } from "../../../lib/entities/user.type";
import { fetchSession, fetchUserProfile, peekSid } from "../auth-client.ts";
import { HOST_ID } from "../constants.ts";
import { ElementPicker, type PickedElement } from "../element-picker.ts";
import { ICONS } from "../icons.ts";
import { avatarFallbackUrl } from "../../shared/avatar.ts";
import {
  DEFAULT_PANEL_HEIGHT,
  DEFAULT_PANEL_WIDTH,
  DEFAULT_POSITION,
  DOCK_WIDTH,
  DRAG_THRESHOLD_PX,
  FAB_MARGIN,
  FAB_SIZE,
  MIN_PANEL_HEIGHT,
  MIN_PANEL_WIDTH,
  defaultIconUrl,
} from "../../shared/defaults.ts";
import type {
  DockPanel,
  FabCoords,
  FabPosition,
  GiyaTheme,
  WidgetConfig,
} from "../../shared/types.ts";
import {
  clampCoords,
  defaultCoords,
  loadStyles,
  requireEl,
} from "./dom.ts";
import { renderCommentPanel } from "./panels/comment.ts";
import { renderConcernsPanel } from "./panels/concerns.ts";
import { renderEnvironmentPanel } from "./panels/environment.ts";
import { renderLoginPanel } from "./panels/login.ts";
import { renderNewTaskPanel } from "./panels/new-task.ts";
import { renderProfilePanel } from "./panels/profile.ts";
import { applyGiyaTheme } from "./theme.ts";
import {
  clearDraftPin,
  fetchPagePins,
  renderDraftPin,
  renderPinLoadingBadge,
  renderSavedPins,
  showSavedPinPopout,
} from "./pins.ts";
import { widgetShellHtml } from "./shell.ts";
import type { WidgetElements } from "./types.ts";

export class FloatingWidget {
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
  /** Anchor rect while peeking a saved pin (click pin → read → close). */
  private pinViewRect: DOMRect | null = null;
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
  private panelResize:
    | {
      pointerId: number;
      startX: number;
      startY: number;
      originW: number;
      originH: number;
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
    root.innerHTML = widgetShellHtml();

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
      panelResize: requireEl<HTMLDivElement>(root, "[data-panel-resize]"),
      highlight: requireEl<HTMLDivElement>(root, "[data-highlight]"),
      pickHint: requireEl<HTMLDivElement>(root, "[data-pick-hint]"),
      pinLayer: requireEl<HTMLDivElement>(root, "[data-pin-layer]"),
      fab: requireEl<HTMLButtonElement>(root, "[data-fab]"),
      fabIcon: requireEl<HTMLImageElement>(root, "[data-fab-icon]"),
      btnNav: requireEl<HTMLButtonElement>(root, "[data-nav]"),
      btnEnv: requireEl<HTMLButtonElement>(root, "[data-env]"),
      btnUser: requireEl<HTMLButtonElement>(root, "[data-user]"),
      btnTheme: requireEl<HTMLButtonElement>(root, "[data-theme]"),
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
    this.applyTheme(this.config.theme || "dark");
    this.bindEvents();
    this.enableKeyShield();
    void this.refreshSession().then((ok) => {
      // One pin load on boot — never force-loop.
      if (ok) void this.refreshPagePins(false);
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
    els.btnNav.addEventListener("click", () => this.onNavClick());
    els.btnEnv.addEventListener("click", () => this.togglePanel("environment"));
    els.btnUser.addEventListener("click", () => this.onUserClick());
    els.btnTheme.addEventListener("click", () => this.toggleTheme());
    els.btnPin.addEventListener("click", () => this.togglePin());
    els.btnClosePanel.addEventListener("click", () => this.onClosePanelClick());
    els.panelHeader.addEventListener("pointerdown", this.onPanelPointerDown);
    els.panelResize.addEventListener("pointerdown", this.onPanelResizePointerDown);
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
          // Fired only when Livro sid is cleared — clear UI, don't refetch storms.
          void this.refreshSession(false).then(async (ok) => {
            if (ok) return;
            this.pagePins = [];
            this.renderSavedPins();
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
      void this.ensureProfile(force);
    } else {
      this.profile = null;
      this.pagePins = [];
      this.pinsHref = null;
      this.renderSavedPins();
    }
    return Boolean(this.session);
  }

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
    if (this.profile?.userImage) return this.profile.userImage;
    return avatarFallbackUrl(
      this.profile?.fullName || this.profile?.email || this.session?.email
    );
  }

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
    if (this.picker.isActive) return;
    if (this.activePanel) {
      this.setPanel(null);
      return;
    }
    if (!this.config.pinned) this.setOpen(false);
  };

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

  private panelSize(): { width: number; height: number } {
    const maxW = Math.max(MIN_PANEL_WIDTH, window.innerWidth - FAB_MARGIN * 2);
    const maxH = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - FAB_MARGIN * 2);
    const width = Math.min(
      maxW,
      Math.max(MIN_PANEL_WIDTH, this.config.panelWidth || DEFAULT_PANEL_WIDTH)
    );
    const height = Math.min(
      maxH,
      Math.max(MIN_PANEL_HEIGHT, this.config.panelHeight || DEFAULT_PANEL_HEIGHT)
    );
    return { width, height };
  }

  private clampPanelCoords(coords: FabCoords): FabCoords {
    const { width, height } = this.panelSize();
    const maxLeft = Math.max(FAB_MARGIN, window.innerWidth - width - FAB_MARGIN);
    const maxTop = Math.max(FAB_MARGIN, window.innerHeight - height - FAB_MARGIN);
    return {
      left: Math.min(maxLeft, Math.max(FAB_MARGIN, coords.left)),
      top: Math.min(maxTop, Math.max(FAB_MARGIN, coords.top)),
    };
  }

  private defaultPanelCoords(): FabCoords {
    const coords = this.config.fabCoords || defaultCoords(this.config.position);
    const { width } = this.panelSize();
    let left = coords.left - width - 12;
    if (left < FAB_MARGIN) left = coords.left + FAB_SIZE + 12;
    return this.clampPanelCoords({ left, top: Math.max(FAB_MARGIN, coords.top - 40) });
  }

  private applyPanelCoords(coords: FabCoords): void {
    const els = this.els;
    if (!els) return;
    const next = this.clampPanelCoords(coords);
    this.panelCoords = next;
    const { width, height } = this.panelSize();
    els.panel.style.left = `${next.left}px`;
    els.panel.style.top = `${next.top}px`;
    els.panel.style.width = `${width}px`;
    els.panel.style.height = `${height}px`;
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

    if (this.anchorCommentToPick && this.picked && this.activePanel === "comment") {
      return;
    }

    this.applyPanelCoords(this.panelCoords || this.defaultPanelCoords());
  }

  private onPanelResizePointerDown = (event: PointerEvent): void => {
    const els = this.els;
    if (!els || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const { width, height } = this.panelSize();
    this.panelResize = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originW: width,
      originH: height,
    };
    els.panelResize.setPointerCapture(event.pointerId);
    els.panelResize.addEventListener("pointermove", this.onPanelResizePointerMove);
    els.panelResize.addEventListener("pointerup", this.onPanelResizePointerUp);
    els.panelResize.addEventListener("pointercancel", this.onPanelResizePointerUp);
    els.panel.classList.remove("transition", "duration-200", "ease-out");
  };

  private onPanelResizePointerMove = (event: PointerEvent): void => {
    const els = this.els;
    if (!els || !this.panelResize || event.pointerId !== this.panelResize.pointerId) {
      return;
    }
    event.preventDefault();
    const maxW = Math.max(MIN_PANEL_WIDTH, window.innerWidth - FAB_MARGIN * 2);
    const maxH = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - FAB_MARGIN * 2);
    const width = Math.min(
      maxW,
      Math.max(MIN_PANEL_WIDTH, this.panelResize.originW + (event.clientX - this.panelResize.startX))
    );
    const height = Math.min(
      maxH,
      Math.max(
        MIN_PANEL_HEIGHT,
        this.panelResize.originH + (event.clientY - this.panelResize.startY)
      )
    );
    this.config.panelWidth = width;
    this.config.panelHeight = height;
    this.applyPanelCoords(this.panelCoords || this.defaultPanelCoords());
  };

  private onPanelResizePointerUp = (event: PointerEvent): void => {
    const els = this.els;
    if (!els || !this.panelResize || event.pointerId !== this.panelResize.pointerId) {
      return;
    }
    els.panelResize.removeEventListener("pointermove", this.onPanelResizePointerMove);
    els.panelResize.removeEventListener("pointerup", this.onPanelResizePointerUp);
    els.panelResize.removeEventListener("pointercancel", this.onPanelResizePointerUp);
    try {
      els.panelResize.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    els.panel.classList.add("transition", "duration-200", "ease-out");
    void chrome.storage.sync.set({
      panelWidth: this.config.panelWidth,
      panelHeight: this.config.panelHeight,
    });
    this.panelResize = null;
  };

  private onPanelPointerDown = (event: PointerEvent): void => {
    const els = this.els;
    if (!els || event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-close-panel]")) return;
    if (target?.closest("[data-panel-resize]")) return;
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
    this.open = wantOpen || (this.config.pinned && Boolean(this.session));
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

  /** Nested flows use back; top-level menus use Concerns icon. */
  private navIsBackMode(): boolean {
    return (
      this.picker.isActive ||
      this.activePanel === "comment" ||
      this.activePanel === "new-task" ||
      this.activePanel === "pin"
    );
  }

  private onNavClick(): void {
    if (this.navIsBackMode()) {
      this.onBackClick();
      return;
    }
    void (async () => {
      if (!(await this.requireSession())) return;
      if (this.activePanel === "concerns") {
        this.setPanel(null);
        return;
      }
      this.setPanel("concerns");
    })();
  }

  private onClosePanelClick(): void {
    if (this.navIsBackMode()) {
      this.onBackClick();
      return;
    }
    this.setPanel(null);
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

    // Saved pin peek: close only — never dump into Concerns.
    if (this.activePanel === "pin") {
      this.pinViewRect = null;
      this.setPanel(null);
      return;
    }

    if (this.activePanel === "comment") {
      this.clearDraftPin();
      this.picked = null;
      this.anchorCommentToPick = false;
      this.setPanel("concerns");
      return;
    }

    if (this.activePanel === "new-task") {
      this.setPanel("concerns");
      return;
    }

    this.setPanel(null);
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

    const backMode = this.navIsBackMode();
    els.btnNav.dataset.mode = backMode ? "back" : "concerns";
    els.btnNav.innerHTML = backMode ? ICONS.back : ICONS.concerns;
    els.btnNav.title = backMode ? "Back" : "Concerns";
    els.btnNav.setAttribute("aria-label", backMode ? "Back" : "Concerns");
    els.btnNav.dataset.active = String(
      backMode || this.activePanel === "concerns"
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
      this.pinViewRect = null;
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
    if (panel !== "pin") {
      this.pinViewRect = null;
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
    } else if (panel === "new-task") {
      this.renderNewTaskPanel();
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
    } else if (panel === "pin") {
      // Content set by showSavedPinPopout.
    } else {
      renderEnvironmentPanel(els);
    }

    this.showPanelVisual();
  }

  private showPanelVisual(): void {
    const els = this.els;
    if (!els) return;
    els.panel.hidden = false;
    const layout = () => {
      if (this.activePanel === "pin" && this.pinViewRect) {
        this.layoutPinnedPopout(this.pinViewRect);
      } else if (this.anchorCommentToPick && this.picked) {
        this.layoutPinnedPopout(this.picked.element.getBoundingClientRect());
      } else {
        this.layoutChrome();
      }
    };
    layout();
    requestAnimationFrame(() => {
      els.panel.classList.remove("scale-95", "opacity-0");
      els.panel.classList.add("scale-100", "opacity-100");
      layout();
    });
  }

  private renderLoginPanel(): void {
    const els = this.els;
    if (!els) return;
    renderLoginPanel(els, {
      otpTmpId: this.otpTmpId,
      pendingLoginEmail: this.pendingLoginEmail,
      focusPanelField: (sel) => this.focusPanelField(sel),
      setOtpTmpId: (id) => {
        this.otpTmpId = id;
      },
      setPendingLoginEmail: (email) => {
        this.pendingLoginEmail = email;
      },
      refreshSession: (force) => this.refreshSession(force),
      refreshPagePins: (force) => this.refreshPagePins(force),
      setPanel: (panel) => this.setPanel(panel),
      renderAgain: () => this.renderLoginPanel(),
    });
  }

  private async renderProfilePanel(): Promise<void> {
    const els = this.els;
    if (!els) return;
    await renderProfilePanel(els, {
      ensureProfile: (force) => this.ensureProfile(force),
      avatarUrl: () => this.avatarUrl(),
      showPanelVisual: () => this.showPanelVisual(),
      onDisconnected: () => {
        this.session = null;
        this.profile = null;
        this.pagePins = [];
        this.renderSavedPins();
        this.showLoginPopout();
      },
    });
  }

  private async renderConcernsPanel(): Promise<void> {
    const els = this.els;
    if (!els) return;
    await renderConcernsPanel(els, {
      showPanelVisual: () => this.showPanelVisual(),
      syncDockActive: () => this.syncDockActive(),
      markConcernsActive: () => {
        this.activePanel = "concerns";
      },
      onSelectConcern: (concern) => {
        this.selectedConcern = concern;
        this.picked = null;
        this.startPicker();
      },
      onNewTask: () => {
        this.setPanel("new-task");
      },
    });
  }

  private renderNewTaskPanel(): void {
    const els = this.els;
    if (!els) return;
    renderNewTaskPanel(els, {
      showPanelVisual: () => this.showPanelVisual(),
      focusPanelField: (sel) => this.focusPanelField(sel),
      onCreated: (concern) => {
        this.selectedConcern = concern;
        this.picked = null;
        this.startPicker();
      },
    });
  }

  private renderCommentPanel(picked: PickedElement): void {
    const els = this.els;
    if (!els || !this.selectedConcern) return;
    renderCommentPanel(els, this.selectedConcern, picked, {
      renderDraftPin: (rect) => this.renderDraftPin(rect),
      clearDraftPin: () => this.clearDraftPin(),
      onChangeConcern: () => {
        this.picked = null;
        this.clearDraftPin();
        void this.renderConcernsPanel();
      },
      onRetarget: () => {
        this.picked = null;
        this.clearDraftPin();
        this.startPicker();
      },
      onSaved: async () => {
        this.picked = null;
        this.anchorCommentToPick = false;
        this.clearDraftPin();
        await this.refreshPagePins(true);
        this.hidePanelVisual();
        this.activePanel = null;
        this.syncDockActive();
      },
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
      this.renderSavedPins();
      return;
    }

    const els = this.els;
    this.loadingPins = true;
    if (els) renderPinLoadingBadge(els, true);
    const href = location.href;
    try {
      this.pinsHref = href;
      this.pagePins = await fetchPagePins(href);
      this.renderSavedPins();
    } finally {
      this.loadingPins = false;
      if (els) renderPinLoadingBadge(els, false);
      if (this.pinsReloadQueued || this.pinsHref !== location.href) {
        this.pinsReloadQueued = false;
        void this.refreshPagePins(false);
      }
    }
  }

  private renderSavedPins(): void {
    const els = this.els;
    if (!els) return;
    renderSavedPins(els, this.pagePins, this.profile, this.avatarUrl(), (item) => {
      this.showSavedPinPopout(item);
    });
  }

  private showSavedPinPopout(item: GiyaPinComment): void {
    const els = this.els;
    if (!els) return;

    this.anchorCommentToPick = false;
    this.picked = null;
    this.clearDraftPin();
    this.pinViewRect = null;
    try {
      const target = document.querySelector(item.pin.selector);
      if (target) this.pinViewRect = target.getBoundingClientRect();
    } catch {
      this.pinViewRect = null;
    }

    this.activePanel = "pin";
    this.syncDockActive();
    showSavedPinPopout(els, item);
    this.showPanelVisual();
  }

  private renderDraftPin(rect: DOMRect): void {
    const els = this.els;
    if (!els) return;
    renderDraftPin(els, rect, this.avatarUrl());
  }

  private clearDraftPin(): void {
    const els = this.els;
    if (!els) return;
    clearDraftPin(els);
  }

  private clearCommentPin(): void {
    this.clearDraftPin();
  }

  private layoutPinnedPopout(rect: DOMRect): void {
    const els = this.els;
    if (!els) return;

    const { width, height } = this.panelSize();
    let left = rect.left + 28;
    let top = rect.top + 12;

    if (left + width > window.innerWidth - FAB_MARGIN) {
      left = Math.max(FAB_MARGIN, rect.left - width - 12);
    }
    if (top + height > window.innerHeight - FAB_MARGIN) {
      top = Math.max(FAB_MARGIN, window.innerHeight - height - FAB_MARGIN);
    }

    els.panel.style.left = `${left}px`;
    els.panel.style.top = `${top}px`;
    els.panel.style.width = `${width}px`;
    els.panel.style.height = `${height}px`;
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

  private toggleTheme(): void {
    const next: GiyaTheme = this.config.theme === "dark" ? "light" : "dark";
    this.applyTheme(next);
    void chrome.storage.sync.set({ theme: next });
  }

  private applyTheme(theme: GiyaTheme): void {
    const next: GiyaTheme = theme === "light" ? "light" : "dark";
    this.config.theme = next;
    const els = this.els;
    if (els) applyGiyaTheme(els.root, next);
    this.syncThemeUi();
  }

  private syncThemeUi(): void {
    const els = this.els;
    if (!els) return;
    const dark = this.config.theme === "dark";
    // Icon shows the mode you'll switch TO.
    els.btnTheme.innerHTML = dark ? ICONS.sun : ICONS.moon;
    els.btnTheme.title = dark ? "Light mode" : "Dark mode";
    els.btnTheme.setAttribute(
      "aria-label",
      dark ? "Switch to light mode" : "Switch to dark mode"
    );
    els.btnTheme.setAttribute("aria-pressed", String(dark));
    els.btnTheme.dataset.active = "false";
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
    if (changes.panelWidth || changes.panelHeight) {
      if (changes.panelWidth) {
        this.config.panelWidth = Math.max(
          MIN_PANEL_WIDTH,
          Number(changes.panelWidth.newValue) || DEFAULT_PANEL_WIDTH
        );
      }
      if (changes.panelHeight) {
        this.config.panelHeight = Math.max(
          MIN_PANEL_HEIGHT,
          Number(changes.panelHeight.newValue) || DEFAULT_PANEL_HEIGHT
        );
      }
      if (this.activePanel) {
        this.applyPanelCoords(this.panelCoords || this.defaultPanelCoords());
      }
    }
    if (changes.theme) {
      const value = changes.theme.newValue;
      this.applyTheme(value === "light" ? "light" : "dark");
    }
    if (changes.pinned) {
      this.config.pinned = Boolean(changes.pinned.newValue);
      this.syncPinUi();
      if (this.config.pinned && this.session) this.setOpen(true);
    }
    if (changes.fabLeft || changes.fabTop) {
      const left =
        changes.fabLeft?.newValue ??
        this.config.fabCoords?.left ??
        defaultCoords(this.config.position).left;
      const top =
        changes.fabTop?.newValue ??
        this.config.fabCoords?.top ??
        defaultCoords(this.config.position).top;
      if (typeof left === "number" && typeof top === "number") {
        this.applyFabCoords({ left, top });
      }
    }
  }
}
