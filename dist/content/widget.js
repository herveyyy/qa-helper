(() => {
  // src/content/auth-client.ts
  function extensionAlive() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }
  async function sendMessage(message) {
    if (!extensionAlive())
      return null;
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (text.includes("Extension context invalidated"))
        return null;
      throw error;
    }
  }
  async function peekSid() {
    const response = await sendMessage({ type: "PEEK_SID" });
    return response?.type === "PEEK_SID" ? response.hasSid : false;
  }
  async function fetchSession(force = false) {
    const response = await sendMessage({ type: "GET_SESSION", force });
    if (response?.type === "SESSION") {
      if (response.ok)
        return { ok: true, session: response.session };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Giya was updated." };
  }
  async function fetchUserProfile() {
    const response = await sendMessage({ type: "GET_USER_PROFILE" });
    if (response?.type === "USER_PROFILE") {
      if (response.ok)
        return { ok: true, profile: response.profile };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Profile unavailable." };
  }
  async function connectErpPassword(usr, pwd) {
    const response = await sendMessage({ type: "CONNECT_ERP", usr, pwd });
    if (response?.type !== "CONNECT_ERP") {
      return { ok: false, error: "Reload this page — Giya was updated." };
    }
    if (!response.ok)
      return { ok: false, error: response.error };
    if (response.needsOtp) {
      return {
        ok: true,
        needsOtp: true,
        tmpId: response.tmpId,
        prompt: response.prompt,
        method: response.method
      };
    }
    return { ok: true, connection: response.connection };
  }
  async function connectErpOtp(tmpId, otp, usr) {
    const response = await sendMessage({ type: "CONNECT_ERP", tmpId, otp, usr });
    if (response?.type !== "CONNECT_ERP") {
      return { ok: false, error: "Reload this page — Giya was updated." };
    }
    if (!response.ok)
      return { ok: false, error: response.error };
    if (response.needsOtp) {
      return { ok: false, error: "Still waiting for verification." };
    }
    return { ok: true, connection: response.connection };
  }
  async function connectErpFromDesk() {
    const response = await sendMessage({ type: "CONNECT_ERP_DESK" });
    if (response?.type !== "CONNECT_ERP") {
      return { ok: false, error: "Reload this page — Giya was updated." };
    }
    if (!response.ok)
      return { ok: false, error: response.error };
    if (response.needsOtp) {
      return { ok: false, error: "Unexpected OTP step." };
    }
    return { ok: true, connection: response.connection };
  }
  async function disconnectErp() {
    await sendMessage({ type: "DISCONNECT_ERP" });
  }

  // src/content/concern-client.ts
  function extensionAlive2() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }
  async function sendMessage2(message) {
    if (!extensionAlive2())
      return null;
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (text.includes("Extension context invalidated"))
        return null;
      throw error;
    }
  }
  async function listConcerns() {
    const response = await sendMessage2({ type: "LIST_CONCERNS" });
    if (response?.type === "CONCERNS") {
      if (response.ok)
        return { ok: true, concerns: response.concerns };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Giya was updated." };
  }
  async function createConcern(input) {
    const response = await sendMessage2({
      type: "CREATE_CONCERN",
      subject: input.subject,
      concernType: input.type,
      priority: input.priority,
      description: input.description
    });
    if (response?.type === "CONCERN_CREATED") {
      if (response.ok)
        return { ok: true, concern: response.concern };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Giya was updated." };
  }
  async function listPagePins(href) {
    const response = await sendMessage2({ type: "LIST_PAGE_PINS", href });
    if (response?.type === "PAGE_PINS") {
      if (response.ok)
        return { ok: true, pins: response.pins };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Giya was updated." };
  }
  async function addConcernPin(concernName, pin) {
    const response = await sendMessage2({
      type: "ADD_CONCERN_PIN",
      concernName,
      pin
    });
    if (response?.type === "PIN_SAVED") {
      if (response.ok)
        return { ok: true, commentName: response.commentName };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Giya was updated." };
  }

  // src/content/constants.ts
  var HOST_ID = "giya-extension-root";

  // src/content/element-picker.ts
  class ElementPicker {
    active = false;
    callbacks = null;
    hovered = null;
    get isActive() {
      return this.active;
    }
    start(callbacks) {
      if (this.active)
        this.stop();
      this.active = true;
      this.callbacks = callbacks;
      document.documentElement.classList.add("giya-picking");
      ensurePickerStyle();
      document.addEventListener("mousemove", this.onMove, true);
      document.addEventListener("click", this.onClick, true);
      document.addEventListener("keydown", this.onKeyDown, true);
      document.addEventListener("scroll", this.onScroll, true);
    }
    stop() {
      if (!this.active)
        return;
      this.active = false;
      this.hovered = null;
      this.callbacks = null;
      document.documentElement.classList.remove("giya-picking");
      document.removeEventListener("mousemove", this.onMove, true);
      document.removeEventListener("click", this.onClick, true);
      document.removeEventListener("keydown", this.onKeyDown, true);
      document.removeEventListener("scroll", this.onScroll, true);
    }
    onMove = (event) => {
      if (!this.active)
        return;
      const el = targetFromPoint(event.clientX, event.clientY);
      this.hovered = el;
      if (!el) {
        this.callbacks?.onHover(null, null);
        return;
      }
      this.callbacks?.onHover(el.getBoundingClientRect(), describeElement(el));
    };
    onScroll = () => {
      if (!this.active || !this.hovered)
        return;
      this.callbacks?.onHover(this.hovered.getBoundingClientRect(), describeElement(this.hovered));
    };
    onClick = (event) => {
      if (!this.active)
        return;
      if (isGiyaUi(event.target))
        return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const el = targetFromPoint(event.clientX, event.clientY) ?? this.hovered;
      if (!el)
        return;
      const picked = {
        element: el,
        label: describeElement(el),
        selector: cssPath(el),
        tagName: el.tagName.toLowerCase()
      };
      const cb = this.callbacks;
      this.stop();
      cb?.onPick(picked);
    };
    onKeyDown = (event) => {
      if (!this.active || event.key !== "Escape")
        return;
      event.preventDefault();
      event.stopPropagation();
      const cb = this.callbacks;
      this.stop();
      cb?.onCancel();
    };
  }
  var PICKER_STYLE_ID = "giya-picker-style";
  function ensurePickerStyle() {
    if (document.getElementById(PICKER_STYLE_ID))
      return;
    const style = document.createElement("style");
    style.id = PICKER_STYLE_ID;
    style.textContent = "html.giya-picking, html.giya-picking * { cursor: crosshair !important; }";
    document.documentElement.appendChild(style);
  }
  function isGiyaUi(target) {
    if (!(target instanceof Node))
      return false;
    const host = document.getElementById(HOST_ID);
    return Boolean(host && (target === host || host.contains(target)));
  }
  function targetFromPoint(x, y) {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (el.id === HOST_ID)
        continue;
      if (el.closest(`#${HOST_ID}`))
        continue;
      if (el === document.documentElement || el === document.body)
        continue;
      return el;
    }
    return document.body;
  }
  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    const suffix = text ? ` “${text}${text.length >= 40 ? "…" : ""}”` : "";
    return `${tag}${id}${cls}${suffix}`;
  }
  function cssPath(el) {
    if (el.id)
      return `#${CSS.escape(el.id)}`;
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          part += `:nth-of-type(${index})`;
        }
      }
      parts.unshift(part);
      current = parent;
      if (parts.length > 6)
        break;
    }
    return parts.join(" > ");
  }

  // src/content/env-specs.ts
  function collectEnvSpecs() {
    const nav = navigator;
    const brands = nav.userAgentData?.brands?.map((b) => `${b.brand} ${b.version}`).join(", ") || "—";
    return [
      { label: "Browser", value: brands },
      { label: "User agent", value: navigator.userAgent },
      { label: "Platform", value: nav.userAgentData?.platform || navigator.platform || "—" },
      { label: "Language", value: navigator.language },
      { label: "Languages", value: navigator.languages?.join(", ") || "—" },
      { label: "Timezone", value: Intl.DateTimeFormat().resolvedOptions().timeZone },
      {
        label: "Screen",
        value: `${screen.width}×${screen.height} @ ${window.devicePixelRatio}x`
      },
      {
        label: "Viewport",
        value: `${window.innerWidth}×${window.innerHeight}`
      },
      {
        label: "CPU cores",
        value: String(navigator.hardwareConcurrency ?? "—")
      },
      {
        label: "Device memory",
        value: nav.deviceMemory != null ? `${nav.deviceMemory} GB` : "—"
      },
      {
        label: "Touch points",
        value: String(navigator.maxTouchPoints ?? 0)
      },
      {
        label: "Online",
        value: navigator.onLine ? "Yes" : "No"
      },
      {
        label: "Cookies",
        value: navigator.cookieEnabled ? "Enabled" : "Disabled"
      },
      {
        label: "Page",
        value: location.href
      },
      {
        label: "Extension",
        value: chrome.runtime.getManifest().version
      }
    ];
  }

  // src/content/icons.ts
  var ICONS = {
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M15 18 9 12l6-6"/></svg>`,
    comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>`,
    environment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
    login: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    spinner: `<svg viewBox="0 0 24 24" fill="none" class="h-4 w-4 animate-spin" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`
  };

  // src/shared/allowed_origins.ts
  function isUrlAllowed(pageUrl, patterns) {
    if (!patterns.length)
      return false;
    let hostname;
    let origin;
    try {
      const u = new URL(pageUrl);
      hostname = u.hostname.toLowerCase();
      origin = u.origin.toLowerCase();
    } catch {
      return false;
    }
    return patterns.some((raw) => matchesPattern(hostname, origin, raw.trim()));
  }
  function matchesPattern(hostname, origin, pattern) {
    if (!pattern)
      return false;
    const lower = pattern.toLowerCase();
    if (lower.includes("://")) {
      try {
        const p = new URL(lower);
        return origin === p.origin.toLowerCase();
      } catch {
        return false;
      }
    }
    if (lower.startsWith("*.")) {
      const base = lower.slice(2);
      if (!base)
        return false;
      return hostname === base || hostname.endsWith(`.${base}`);
    }
    return hostname === lower || hostname.endsWith(`.${lower}`);
  }

  // src/shared/defaults.ts
  var DEFAULT_POSITION = "bottom-right";
  var DEFAULT_SIDEBAR_WIDTH = 360;
  var FAB_SIZE = 32;
  var DOCK_WIDTH = 44;
  var FAB_MARGIN = 16;
  var DRAG_THRESHOLD_PX = 4;
  var DEFAULT_ALLOWED_ORIGINS = ["wela.dev"];
  var STORAGE_DEFAULTS = {
    iconUrl: "",
    position: DEFAULT_POSITION,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    fabLeft: null,
    fabTop: null,
    pinned: false,
    allowedOrigins: DEFAULT_ALLOWED_ORIGINS
  };
  function defaultIconUrl() {
    return chrome.runtime.getURL("assets/giya-icon.png");
  }

  // src/content/widget.ts
  var iconBtnClass = "grid h-8 w-8 place-items-center rounded-full text-neutral-700 transition hover:bg-black/8 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 data-[active=true]:bg-black data-[active=true]:text-white";
  async function loadConfig() {
    const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);
    const fabLeft = stored.fabLeft;
    const fabTop = stored.fabTop;
    return {
      iconUrl: stored.iconUrl || defaultIconUrl(),
      position: stored.position || DEFAULT_POSITION,
      sidebarWidth: Number(stored.sidebarWidth) || DEFAULT_SIDEBAR_WIDTH,
      fabCoords: typeof fabLeft === "number" && typeof fabTop === "number" ? { left: fabLeft, top: fabTop } : null,
      pinned: Boolean(stored.pinned)
    };
  }
  async function loadStyles(shadow) {
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
  function defaultCoords(position) {
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
  function clampCoords(coords) {
    const maxLeft = Math.max(FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN);
    const maxTop = Math.max(FAB_MARGIN, window.innerHeight - FAB_SIZE - FAB_MARGIN);
    return {
      left: Math.min(maxLeft, Math.max(FAB_MARGIN, coords.left)),
      top: Math.min(maxTop, Math.max(FAB_MARGIN, coords.top))
    };
  }
  function requireEl(root, selector) {
    const el = root.querySelector(selector);
    if (!el)
      throw new Error(`Missing element: ${selector}`);
    return el;
  }
  function concernNameFromLocation() {
    const path = decodeURIComponent(location.pathname);
    const match = path.match(/\/app\/sprint-backlogs\/(SPB-\d+)/i);
    return match?.[1] ?? null;
  }
  function loadingMarkup(message) {
    return `
    <div class="flex items-center gap-2 py-1 text-xs text-neutral-500" role="status" aria-live="polite" aria-busy="true">
      ${ICONS.spinner}
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  }
  function setButtonBusy(button, busy, idleHtml) {
    if (!button)
      return;
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    button.classList.toggle("opacity-70", busy);
    button.classList.toggle("pointer-events-none", busy);
    button.innerHTML = busy ? ICONS.spinner : idleHtml;
  }

  class FloatingWidget {
    config;
    open = false;
    activePanel = null;
    host = null;
    shadow = null;
    els = null;
    picker = new ElementPicker;
    picked = null;
    session = null;
    profile = null;
    authChecked = false;
    anchorCommentToPick = false;
    selectedConcern = null;
    pagePins = [];
    loadingPins = false;
    otpTmpId = null;
    pendingLoginEmail = "";
    keysShielded = false;
    panelCoords = null;
    pinsHref = null;
    pinsReloadQueued = false;
    drag = null;
    panelDrag = null;
    suppressClick = false;
    constructor(config) {
      this.config = config;
    }
    async mount() {
      if (document.getElementById(HOST_ID))
        return;
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
        backdrop: requireEl(root, "[data-backdrop]"),
        dock: requireEl(root, "[data-dock]"),
        panel: requireEl(root, "[data-panel]"),
        panelHeader: requireEl(root, "[data-panel-header]"),
        panelTitle: requireEl(root, "[data-panel-title]"),
        panelBody: requireEl(root, "[data-panel-body]"),
        highlight: requireEl(root, "[data-highlight]"),
        pickHint: requireEl(root, "[data-pick-hint]"),
        pinLayer: requireEl(root, "[data-pin-layer]"),
        fab: requireEl(root, "[data-fab]"),
        fabIcon: requireEl(root, "[data-fab-icon]"),
        btnBack: requireEl(root, "[data-back]"),
        btnEnv: requireEl(root, "[data-env]"),
        btnUser: requireEl(root, "[data-user]"),
        btnPin: requireEl(root, "[data-pin]"),
        btnClosePanel: requireEl(root, "[data-close-panel]")
      };
      this.applyIcon(this.config.iconUrl);
      this.applyFabCoords(this.config.fabCoords ? clampCoords(this.config.fabCoords) : defaultCoords(this.config.position));
      this.syncPinUi();
      this.bindEvents();
      this.enableKeyShield();
      this.refreshSession().then((ok) => {
        if (ok)
          this.refreshPagePins(true);
        if (this.config.pinned && this.session) {
          this.setOpen(true);
          this.setPanel("concerns");
        }
      });
    }
    bindEvents() {
      const els = this.els;
      if (!els)
        return;
      els.fab.addEventListener("pointerdown", this.onPointerDown);
      els.fab.addEventListener("click", this.onFabClick, true);
      els.btnBack.addEventListener("click", () => this.onBackClick());
      els.btnEnv.addEventListener("click", () => this.togglePanel("environment"));
      els.btnUser.addEventListener("click", () => this.onUserClick());
      els.btnPin.addEventListener("click", () => this.togglePin());
      els.btnClosePanel.addEventListener("click", () => this.onBackClick());
      els.panelHeader.addEventListener("pointerdown", this.onPanelPointerDown);
      els.backdrop.addEventListener("click", () => {
        if (this.picker.isActive)
          return;
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
        chrome.runtime.onMessage.addListener((message) => {
          if (!chrome.runtime?.id)
            return;
          if (message?.type === "AUTH_CHANGED") {
            this.refreshSession(true).then(async (ok) => {
              if (ok) {
                this.refreshPagePins(true);
                if (this.activePanel === "login") {
                  this.setPanel("concerns");
                }
                return;
              }
              this.pagePins = [];
              this.renderSavedPins();
              if (this.open && this.activePanel !== "login") {
                const hasSid = await peekSid();
                if (!hasSid)
                  this.showLoginPopout();
              }
            });
          }
          return;
        });
      } catch {}
    }
    async refreshSession(force = false) {
      const result = await fetchSession(force);
      this.authChecked = true;
      this.session = result.ok ? result.session : null;
      if (this.session) {
        this.ensureProfile(force);
      } else {
        this.profile = null;
        this.pagePins = [];
        this.pinsHref = null;
        this.renderSavedPins();
      }
      return Boolean(this.session);
    }
    async ensureProfile(force = false) {
      if (!force && this.profile?.userImage && this.profile.userImage.startsWith("data:")) {
        return this.profile;
      }
      const result = await fetchUserProfile();
      if (result.ok) {
        this.profile = result.profile;
        return this.profile;
      }
      return this.profile;
    }
    avatarUrl() {
      return this.profile?.userImage || defaultIconUrl();
    }
    async requireSession() {
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
    showLoginPopout() {
      if (!this.open)
        this.setOpen(true, { allowSignedOut: true });
      this.setPanel("login");
    }
    onFabClick = (event) => {
      if (!this.suppressClick)
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.suppressClick = false;
    };
    onPointerDown = (event) => {
      const els = this.els;
      if (!els || event.button !== 0)
        return;
      const fab = els.fab;
      const rect = fab.getBoundingClientRect();
      this.suppressClick = false;
      this.drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: rect.left,
        originTop: rect.top,
        moved: false
      };
      fab.setPointerCapture(event.pointerId);
      fab.addEventListener("pointermove", this.onPointerMove);
      fab.addEventListener("pointerup", this.onPointerUp);
      fab.addEventListener("pointercancel", this.onPointerUp);
    };
    onPointerMove = (event) => {
      const els = this.els;
      if (!els || !this.drag || event.pointerId !== this.drag.pointerId)
        return;
      const dx = event.clientX - this.drag.startX;
      const dy = event.clientY - this.drag.startY;
      if (!this.drag.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX)
          return;
        this.drag.moved = true;
        this.suppressClick = true;
        els.fab.classList.add("scale-105");
        els.fab.classList.remove("transition-transform");
      }
      event.preventDefault();
      this.applyFabCoords(clampCoords({
        left: this.drag.originLeft + dx,
        top: this.drag.originTop + dy
      }));
    };
    onPointerUp = (event) => {
      const els = this.els;
      if (!els || !this.drag || event.pointerId !== this.drag.pointerId)
        return;
      const { moved } = this.drag;
      els.fab.removeEventListener("pointermove", this.onPointerMove);
      els.fab.removeEventListener("pointerup", this.onPointerUp);
      els.fab.removeEventListener("pointercancel", this.onPointerUp);
      try {
        els.fab.releasePointerCapture(event.pointerId);
      } catch {}
      els.fab.classList.add("transition-transform");
      if (!this.open)
        els.fab.classList.remove("scale-105");
      this.drag = null;
      if (moved) {
        this.suppressClick = true;
        if (this.config.fabCoords) {
          chrome.storage.sync.set({
            fabLeft: this.config.fabCoords.left,
            fabTop: this.config.fabCoords.top
          });
        }
        this.layoutChrome();
        return;
      }
      this.toggle();
    };
    onResize = () => {
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
    onLocationMaybeChanged = () => {
      if (this.pinsHref === location.href)
        return;
      this.refreshPagePins(true);
    };
    patchHistoryForPins() {
      const notify = () => this.onLocationMaybeChanged();
      const wrap = (method) => {
        const original = history[method].bind(history);
        history[method] = (...args) => {
          const result = original(...args);
          notify();
          return result;
        };
      };
      try {
        wrap("pushState");
        wrap("replaceState");
      } catch {}
    }
    onScrollOrResize = () => {
      this.renderSavedPins();
      if (!this.anchorCommentToPick || !this.picked || this.activePanel !== "comment")
        return;
      this.syncPinnedChrome();
    };
    syncPinnedChrome() {
      this.layoutChrome();
      this.renderSavedPins();
      if (!this.anchorCommentToPick || !this.picked || this.activePanel !== "comment")
        return;
      if (!this.picked.element.isConnected) {
        this.setPanel(null);
        return;
      }
      const rect = this.picked.element.getBoundingClientRect();
      this.renderDraftPin(rect);
      this.layoutPinnedPopout(rect);
    }
    onKeyDown = (event) => {
      if (event.key !== "Escape")
        return;
      if (this.picker.isActive)
        return;
      if (this.activePanel) {
        this.setPanel(null);
        return;
      }
      if (!this.config.pinned)
        this.setOpen(false);
    };
    focusedGiyaField() {
      const active = this.shadow?.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        return active;
      }
      return null;
    }
    enableKeyShield() {
      if (this.keysShielded)
        return;
      this.keysShielded = true;
      window.addEventListener("keydown", this.onKeyShield, true);
      window.addEventListener("keypress", this.onKeyShield, true);
      window.addEventListener("keyup", this.onKeyShield, true);
    }
    onKeyShield = (event) => {
      if (!this.focusedGiyaField())
        return;
      event.stopImmediatePropagation();
      if (event.type === "keydown" && event.key === "Escape") {
        event.preventDefault();
        this.onKeyDown(event);
      }
    };
    focusPanelField(selector) {
      const els = this.els;
      if (!els)
        return;
      requestAnimationFrame(() => {
        const field = els.panelBody.querySelector(selector);
        field?.focus({ preventScroll: true });
      });
    }
    applyIcon(iconUrl) {
      const els = this.els;
      if (!els)
        return;
      this.config.iconUrl = iconUrl || defaultIconUrl();
      els.fabIcon.src = this.config.iconUrl;
    }
    applyFabCoords(coords) {
      const els = this.els;
      if (!els)
        return;
      const next = clampCoords(coords);
      this.config.fabCoords = next;
      els.fab.style.left = `${next.left}px`;
      els.fab.style.top = `${next.top}px`;
      els.fab.style.right = "auto";
      els.fab.style.bottom = "auto";
      this.layoutChrome();
    }
    applyPosition(position) {
      this.config.position = position || DEFAULT_POSITION;
      if (!this.config.fabCoords) {
        this.applyFabCoords(defaultCoords(this.config.position));
      }
    }
    applySidebarWidth(_width) {}
    clampPanelCoords(coords) {
      const els = this.els;
      const panelWidth = Math.min(288, window.innerWidth - FAB_MARGIN * 2);
      const panelHeight = els?.panel.offsetHeight || 240;
      const maxLeft = Math.max(FAB_MARGIN, window.innerWidth - panelWidth - FAB_MARGIN);
      const maxTop = Math.max(FAB_MARGIN, window.innerHeight - panelHeight - FAB_MARGIN);
      return {
        left: Math.min(maxLeft, Math.max(FAB_MARGIN, coords.left)),
        top: Math.min(maxTop, Math.max(FAB_MARGIN, coords.top))
      };
    }
    defaultPanelCoords() {
      const coords = this.config.fabCoords || defaultCoords(this.config.position);
      const panelWidth = Math.min(288, window.innerWidth - FAB_MARGIN * 2);
      let left = coords.left - panelWidth - 12;
      if (left < FAB_MARGIN)
        left = coords.left + FAB_SIZE + 12;
      return this.clampPanelCoords({ left, top: Math.max(FAB_MARGIN, coords.top - 40) });
    }
    applyPanelCoords(coords) {
      const els = this.els;
      if (!els)
        return;
      const next = this.clampPanelCoords(coords);
      this.panelCoords = next;
      const panelWidth = Math.min(288, window.innerWidth - FAB_MARGIN * 2);
      els.panel.style.left = `${next.left}px`;
      els.panel.style.top = `${next.top}px`;
      els.panel.style.width = `${panelWidth}px`;
    }
    layoutChrome() {
      const els = this.els;
      const coords = this.config.fabCoords;
      if (!els || !coords)
        return;
      const dockLeft = Math.min(Math.max(FAB_MARGIN, coords.left + FAB_SIZE / 2 - DOCK_WIDTH / 2), window.innerWidth - DOCK_WIDTH - FAB_MARGIN);
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
    onPanelPointerDown = (event) => {
      const els = this.els;
      if (!els || event.button !== 0)
        return;
      const target = event.target;
      if (target?.closest("[data-close-panel]"))
        return;
      if (this.anchorCommentToPick && this.activePanel === "comment")
        return;
      const rect = els.panel.getBoundingClientRect();
      this.panelDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: rect.left,
        originTop: rect.top,
        moved: false
      };
      els.panelHeader.setPointerCapture(event.pointerId);
      els.panelHeader.addEventListener("pointermove", this.onPanelPointerMove);
      els.panelHeader.addEventListener("pointerup", this.onPanelPointerUp);
      els.panelHeader.addEventListener("pointercancel", this.onPanelPointerUp);
    };
    onPanelPointerMove = (event) => {
      const els = this.els;
      if (!els || !this.panelDrag || event.pointerId !== this.panelDrag.pointerId)
        return;
      const dx = event.clientX - this.panelDrag.startX;
      const dy = event.clientY - this.panelDrag.startY;
      if (!this.panelDrag.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX)
          return;
        this.panelDrag.moved = true;
        els.panel.classList.remove("transition", "duration-200", "ease-out");
      }
      event.preventDefault();
      this.applyPanelCoords({
        left: this.panelDrag.originLeft + dx,
        top: this.panelDrag.originTop + dy
      });
    };
    onPanelPointerUp = (event) => {
      const els = this.els;
      if (!els || !this.panelDrag || event.pointerId !== this.panelDrag.pointerId)
        return;
      els.panelHeader.removeEventListener("pointermove", this.onPanelPointerMove);
      els.panelHeader.removeEventListener("pointerup", this.onPanelPointerUp);
      els.panelHeader.removeEventListener("pointercancel", this.onPanelPointerUp);
      try {
        els.panelHeader.releasePointerCapture(event.pointerId);
      } catch {}
      els.panel.classList.add("transition", "duration-200", "ease-out");
      this.panelDrag = null;
    };
    async toggle() {
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
      this.refreshPagePins();
      this.setPanel("concerns");
    }
    setOpen(next, options = {}) {
      const els = this.els;
      if (!els)
        return;
      const wantOpen = Boolean(next);
      this.open = wantOpen || this.config.pinned && Boolean(this.session);
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
    onBackClick() {
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
    onUserClick() {
      (async () => {
        if (!await this.requireSession())
          return;
        if (this.activePanel === "profile") {
          this.setPanel(null);
          return;
        }
        this.setPanel("profile");
      })();
    }
    togglePanel(panel) {
      (async () => {
        if (!await this.requireSession())
          return;
        if (this.picker.isActive)
          this.stopPicker();
        this.setPanel(this.activePanel === panel ? null : panel);
      })();
    }
    startPicker() {
      const els = this.els;
      if (!els)
        return;
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
        }
      });
    }
    stopPicker() {
      if (!this.picker.isActive)
        return;
      this.picker.stop();
      this.clearHighlight();
      this.hidePickHint();
      this.restoreBackdrop();
    }
    restoreBackdrop() {
      const els = this.els;
      if (!els || !this.open)
        return;
      els.backdrop.classList.remove("pointer-events-none");
      if (this.config.pinned) {
        els.backdrop.classList.add("invisible", "opacity-0");
        els.backdrop.classList.remove("opacity-100");
      } else {
        els.backdrop.classList.remove("invisible", "opacity-0");
        els.backdrop.classList.add("opacity-100");
      }
    }
    renderHighlight(rect, _label) {
      const els = this.els;
      if (!els)
        return;
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
    clearHighlight() {
      const els = this.els;
      if (!els)
        return;
      els.highlight.classList.add("opacity-0");
      els.highlight.classList.remove("opacity-100");
      els.highlight.hidden = true;
    }
    hidePickHint() {
      const els = this.els;
      if (!els)
        return;
      els.pickHint.classList.add("opacity-0");
      els.pickHint.classList.remove("opacity-100");
      els.pickHint.hidden = true;
    }
    hidePanelVisual() {
      const els = this.els;
      if (!els)
        return;
      els.panel.classList.add("scale-95", "opacity-0");
      els.panel.hidden = true;
    }
    syncDockActive() {
      const els = this.els;
      if (!els)
        return;
      els.btnBack.dataset.active = String(this.activePanel === "comment" || this.activePanel === "concerns" || this.picker.isActive);
      els.btnEnv.dataset.active = String(this.activePanel === "environment");
      els.btnUser.dataset.active = String(this.activePanel === "profile");
    }
    setPanel(panel) {
      const els = this.els;
      if (!els)
        return;
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
        this.renderProfilePanel();
        return;
      } else if (panel === "concerns") {
        this.renderConcernsPanel();
        return;
      } else if (panel === "comment") {
        if (!this.selectedConcern) {
          this.renderConcernsPanel();
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
          ${specs.map((s) => `
            <div>
              <dt class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">${escapeHtml(s.label)}</dt>
              <dd class="break-all text-xs leading-snug text-neutral-800">${escapeHtml(s.value)}</dd>
            </div>`).join("")}
        </dl>
      `;
      }
      this.showPanelVisual();
    }
    showPanelVisual() {
      const els = this.els;
      if (!els)
        return;
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
    renderLoginPanel() {
      const els = this.els;
      if (!els)
        return;
      els.panelTitle.textContent = "Connect Livro";
      const otpMode = Boolean(this.otpTmpId);
      els.panelBody.innerHTML = otpMode ? `
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
      </div>` : `
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
      const submitLogin = els.panelBody.querySelector("[data-submit-login]");
      submitLogin?.addEventListener("click", () => {
        (async () => {
          const email = els.panelBody.querySelector("[data-email]")?.value.trim() || "";
          const pwd = els.panelBody.querySelector("[data-password]")?.value || "";
          if (!email || !pwd) {
            if (status)
              status.textContent = "Email and password are required.";
            return;
          }
          this.pendingLoginEmail = email;
          if (status)
            status.innerHTML = loadingMarkup("Connecting to Livro…");
          setButtonBusy(submitLogin, true, `${ICONS.login} Connect Livro`);
          const result = await connectErpPassword(email, pwd);
          setButtonBusy(submitLogin, false, `${ICONS.login} Connect Livro`);
          if (!result.ok) {
            if (status)
              status.textContent = result.error;
            return;
          }
          if (result.needsOtp) {
            this.otpTmpId = result.tmpId;
            this.renderLoginPanel();
            const nextStatus = this.els?.panelBody.querySelector("[data-auth-status]");
            if (nextStatus)
              nextStatus.textContent = result.prompt;
            return;
          }
          const ok = await this.refreshSession(true);
          if (!ok) {
            if (status)
              status.textContent = "Connected but session not ready. Retry.";
            return;
          }
          this.refreshPagePins(true);
          this.setPanel("concerns");
        })();
      });
      const submitOtp = els.panelBody.querySelector("[data-submit-otp]");
      submitOtp?.addEventListener("click", () => {
        (async () => {
          const otp = els.panelBody.querySelector("[data-otp]")?.value.trim() || "";
          if (!this.otpTmpId || !otp) {
            if (status)
              status.textContent = "Enter the verification code.";
            return;
          }
          if (status)
            status.innerHTML = loadingMarkup("Verifying…");
          setButtonBusy(submitOtp, true, `${ICONS.login} Verify & connect`);
          const result = await connectErpOtp(this.otpTmpId, otp, this.pendingLoginEmail);
          setButtonBusy(submitOtp, false, `${ICONS.login} Verify & connect`);
          if (!result.ok) {
            if (status)
              status.textContent = result.error;
            return;
          }
          this.otpTmpId = null;
          const ok = await this.refreshSession(true);
          if (!ok) {
            if (status)
              status.textContent = "Connected but session not ready. Retry.";
            return;
          }
          this.refreshPagePins(true);
          this.setPanel("concerns");
        })();
      });
      const deskBtn = els.panelBody.querySelector("[data-connect-desk]");
      deskBtn?.addEventListener("click", () => {
        (async () => {
          if (status)
            status.innerHTML = loadingMarkup("Linking Desk SID…");
          setButtonBusy(deskBtn, true, "Use current Desk session");
          const result = await connectErpFromDesk();
          setButtonBusy(deskBtn, false, "Use current Desk session");
          if (!result.ok) {
            if (status)
              status.textContent = result.error;
            return;
          }
          const ok = await this.refreshSession(true);
          if (!ok) {
            if (status)
              status.textContent = "Connected but session not ready. Retry.";
            return;
          }
          this.refreshPagePins(true);
          this.setPanel("concerns");
        })();
      });
    }
    async renderProfilePanel() {
      const els = this.els;
      if (!els)
        return;
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
        (async () => {
          await disconnectErp();
          this.session = null;
          this.profile = null;
          this.pagePins = [];
          this.renderSavedPins();
          this.showLoginPopout();
        })();
      });
    }
    async renderConcernsPanel() {
      const els = this.els;
      if (!els)
        return;
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
        const retry = els.panelBody.querySelector("[data-retry-concerns]");
        retry?.addEventListener("click", () => {
          this.renderConcernsPanel();
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
      const listMarkup = result.concerns.length === 0 ? `<p class="text-xs leading-relaxed text-neutral-600">
            No open concerns yet. Create one below for QA on this page.
          </p>` : `
      <p class="mb-2 text-xs text-neutral-500">
        ${escapeHtml(sprintLabel)} · current assignee. Pick a concern, then pin a UI element.
      </p>
      <ul class="space-y-1.5">
        ${result.concerns.map((c) => `
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
          </li>`).join("")}
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
      const subjectInput = els.panelBody.querySelector("[data-create-subject]");
      const typeSelect = els.panelBody.querySelector("[data-create-type]");
      const createBtn = els.panelBody.querySelector("[data-create-spb]");
      const createStatus = els.panelBody.querySelector("[data-create-status]");
      const runCreate = () => {
        (async () => {
          const subject = subjectInput?.value.trim() || "";
          if (!subject) {
            if (createStatus)
              createStatus.textContent = "Enter a subject.";
            return;
          }
          if (createBtn)
            createBtn.disabled = true;
          if (createStatus)
            createStatus.textContent = "Creating…";
          const created = await createConcern({
            subject,
            type: typeSelect?.value || "Bugs/Issues",
            description: `<p>Created from Giya on <a href="${escapeHtml(location.href)}">${escapeHtml(location.href)}</a></p>`
          });
          if (!created.ok) {
            if (createStatus)
              createStatus.textContent = created.error;
            if (createBtn)
              createBtn.disabled = false;
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
      for (const btn of els.panelBody.querySelectorAll("[data-concern]")) {
        btn.addEventListener("click", () => {
          const name = btn.dataset.concern;
          const concern = result.concerns.find((c) => c.name === name) || null;
          if (!concern)
            return;
          this.selectedConcern = concern;
          this.picked = null;
          this.startPicker();
        });
      }
    }
    renderCommentPanel(picked) {
      const els = this.els;
      if (!els || !this.selectedConcern)
        return;
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
      const input = els.panelBody.querySelector("[data-comment-input]");
      const status = els.panelBody.querySelector("[data-comment-status]");
      els.panelBody.querySelector("[data-change-concern]")?.addEventListener("click", () => {
        this.picked = null;
        this.clearDraftPin();
        this.renderConcernsPanel();
      });
      els.panelBody.querySelector("[data-retarget]")?.addEventListener("click", () => {
        this.picked = null;
        this.clearDraftPin();
        this.startPicker();
      });
      const submitBtn = submit;
      const sendIdle = ICONS.send;
      submitBtn?.addEventListener("click", () => {
        (async () => {
          const text = input?.value.trim() ?? "";
          if (!text) {
            if (status)
              status.textContent = "Write something first.";
            return;
          }
          if (status)
            status.innerHTML = loadingMarkup("Saving to Livro…");
          setButtonBusy(submitBtn, true, sendIdle);
          if (input)
            input.disabled = true;
          const result = await addConcernPin(concern.name, {
            v: 1,
            href: location.href,
            selector: picked.selector,
            label: picked.label,
            tagName: picked.tagName,
            text,
            envSpecs: collectEnvSpecs()
          });
          if (!result.ok) {
            setButtonBusy(submitBtn, false, sendIdle);
            if (input)
              input.disabled = false;
            if (status)
              status.textContent = result.error;
            return;
          }
          if (input)
            input.value = "";
          if (status)
            status.innerHTML = loadingMarkup("Refreshing pins…");
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
    async refreshPagePins(force = false) {
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
          this.refreshPagePins(true);
        }
      }
    }
    renderPinLoadingBadge(show) {
      const els = this.els;
      if (!els)
        return;
      els.pinLayer.querySelector("[data-pin-loading]")?.remove();
      if (!show)
        return;
      const badge = document.createElement("div");
      badge.dataset.pinLoading = "1";
      badge.className = "pointer-events-none fixed bottom-4 right-4 z-[5] flex items-center gap-2 rounded-full border border-white/50 bg-white/80 px-3 py-1.5 text-xs text-neutral-600 shadow-md backdrop-blur-md";
      badge.setAttribute("role", "status");
      badge.setAttribute("aria-live", "polite");
      badge.innerHTML = `${ICONS.spinner}<span>Loading pins…</span>`;
      els.pinLayer.appendChild(badge);
    }
    renderSavedPins() {
      const els = this.els;
      if (!els)
        return;
      for (const node of els.pinLayer.querySelectorAll("[data-saved-pin]")) {
        node.remove();
      }
      for (const item of this.pagePins) {
        let target = null;
        try {
          target = document.querySelector(item.pin.selector);
        } catch {
          target = null;
        }
        if (!target)
          continue;
        const rect = target.getBoundingClientRect();
        if (rect.width <= 0 && rect.height <= 0)
          continue;
        const pin = document.createElement("div");
        pin.dataset.savedPin = item.commentName;
        pin.className = "pointer-events-auto absolute";
        pin.style.left = `${rect.left}px`;
        pin.style.top = `${Math.max(8, rect.top - 8)}px`;
        pin.title = `${item.concernName}: ${item.pin.text}`;
        const avatar = item.commentEmail === this.profile?.email || item.commentEmail === this.profile?.userName ? this.avatarUrl() : defaultIconUrl();
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
    showSavedPinPopout(item) {
      const els = this.els;
      if (!els)
        return;
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
    renderDraftPin(rect) {
      const els = this.els;
      if (!els)
        return;
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
    clearDraftPin() {
      const els = this.els;
      if (!els)
        return;
      els.pinLayer.querySelector("[data-draft-pin]")?.remove();
    }
    clearCommentPin() {
      this.clearDraftPin();
    }
    layoutPinnedPopout(rect) {
      const els = this.els;
      if (!els)
        return;
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
    togglePin() {
      (async () => {
        if (!await this.requireSession())
          return;
        this.togglePinUnlocked();
      })();
    }
    togglePinUnlocked() {
      this.config.pinned = !this.config.pinned;
      chrome.storage.sync.set({ pinned: this.config.pinned });
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
    syncPinUi() {
      const els = this.els;
      if (!els)
        return;
      els.btnPin.dataset.active = String(this.config.pinned);
      els.btnPin.setAttribute("aria-pressed", String(this.config.pinned));
      els.btnPin.title = this.config.pinned ? "Unpin toolbar" : "Pin toolbar";
      els.btnPin.setAttribute("aria-label", this.config.pinned ? "Unpin toolbar" : "Pin toolbar");
    }
    updateFromStorage(changes) {
      if (changes.iconUrl) {
        this.applyIcon(changes.iconUrl.newValue || defaultIconUrl());
      }
      if (changes.position) {
        this.applyPosition(changes.position.newValue);
      }
      if (changes.sidebarWidth) {
        this.applySidebarWidth(Number(changes.sidebarWidth.newValue));
      }
      if (changes.pinned) {
        this.config.pinned = Boolean(changes.pinned.newValue);
        this.syncPinUi();
        if (this.config.pinned && this.session)
          this.setOpen(true);
      }
      if (changes.fabLeft || changes.fabTop) {
        const left = changes.fabLeft?.newValue ?? this.config.fabCoords?.left ?? defaultCoords(this.config.position).left;
        const top = changes.fabTop?.newValue ?? this.config.fabCoords?.top ?? defaultCoords(this.config.position).top;
        if (typeof left === "number" && typeof top === "number") {
          this.applyFabCoords({ left, top });
        }
      }
    }
  }
  function escapeHtml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }
  async function boot() {
    try {
      if (!chrome.runtime?.id)
        return;
    } catch {
      return;
    }
    const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);
    const allowed = Array.isArray(stored.allowedOrigins) && stored.allowedOrigins.length > 0 ? stored.allowedOrigins : STORAGE_DEFAULTS.allowedOrigins;
    if (!isUrlAllowed(location.href, allowed))
      return;
    const config = await loadConfig();
    const widget = new FloatingWidget(config);
    await widget.mount();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (!chrome.runtime?.id || area !== "sync")
        return;
      if (changes.allowedOrigins) {
        const next = Array.isArray(changes.allowedOrigins.newValue) ? changes.allowedOrigins.newValue : STORAGE_DEFAULTS.allowedOrigins;
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
      boot();
    }, { once: true });
  } else {
    boot();
  }
})();

//# debugId=2F4D06C6C92F83A664756E2164756E21
//# sourceMappingURL=widget.js.map
