(() => {
  // src/content/constants.ts
  var HOST_ID = "giya-extension-root";

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

  // src/shared/brand.ts
  var FAYE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
  function fayeLogoDataUrl() {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FAYE_LOGO_SVG)}`;
  }

  // src/shared/defaults.ts
  var DEFAULT_POSITION = "bottom-right";
  var DEFAULT_SIDEBAR_WIDTH = 360;
  var DEFAULT_PANEL_WIDTH = 380;
  var DEFAULT_PANEL_HEIGHT = 440;
  var MIN_PANEL_WIDTH = 280;
  var MIN_PANEL_HEIGHT = 240;
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
    theme: "dark",
    panelWidth: DEFAULT_PANEL_WIDTH,
    panelHeight: DEFAULT_PANEL_HEIGHT,
    allowedOrigins: DEFAULT_ALLOWED_ORIGINS
  };
  function defaultIconUrl() {
    return fayeLogoDataUrl();
  }

  // src/content/icons.ts
  var ICONS = {
    logo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M15 18 9 12l6-6"/></svg>`,
    comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>`,
    environment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
    login: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
    concerns: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    spinner: `<svg viewBox="0 0 24 24" fill="none" class="h-4 w-4 animate-spin" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`
  };

  // src/content/widget/dom.ts
  function escapeHtml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
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
  function requireEl(root, selector) {
    const el = root.querySelector(selector);
    if (!el)
      throw new Error(`Missing element: ${selector}`);
    return el;
  }
  async function loadConfig() {
    const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);
    const fabLeft = stored.fabLeft;
    const fabTop = stored.fabTop;
    const theme = stored.theme === "light" || stored.theme === "dark" ? stored.theme : "dark";
    const panelWidth = Math.max(MIN_PANEL_WIDTH, Number(stored.panelWidth) || DEFAULT_PANEL_WIDTH);
    const panelHeight = Math.max(MIN_PANEL_HEIGHT, Number(stored.panelHeight) || DEFAULT_PANEL_HEIGHT);
    return {
      iconUrl: stored.iconUrl || defaultIconUrl(),
      position: stored.position || DEFAULT_POSITION,
      sidebarWidth: Number(stored.sidebarWidth) || DEFAULT_SIDEBAR_WIDTH,
      fabCoords: typeof fabLeft === "number" && typeof fabTop === "number" ? { left: fabLeft, top: fabTop } : null,
      pinned: Boolean(stored.pinned),
      theme,
      panelWidth,
      panelHeight
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
  function concernNameFromLocation() {
    const path = decodeURIComponent(location.pathname);
    const match = path.match(/\/app\/sprint-backlogs\/(SPB-\d+)/i);
    return match?.[1] ?? null;
  }

  // src/shared/runtime_message.ts
  function extensionAlive() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }
  function sendRuntimeMessage(message) {
    if (!extensionAlive())
      return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const runtime = chrome.runtime;
        runtime.sendMessage(message, (response) => {
          if (runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response ?? null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  // src/content/auth-client.ts
  async function peekSid() {
    const response = await sendRuntimeMessage({ type: "PEEK_SID" });
    return response?.type === "PEEK_SID" ? response.hasSid : false;
  }
  async function fetchSession(force = false) {
    const response = await sendRuntimeMessage({ type: "GET_SESSION", force });
    if (response?.type === "SESSION") {
      if (response.ok)
        return { ok: true, session: response.session };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Faye was updated." };
  }
  async function fetchUserProfile() {
    const response = await sendRuntimeMessage({ type: "GET_USER_PROFILE" });
    if (response?.type === "USER_PROFILE") {
      if (response.ok)
        return { ok: true, profile: response.profile };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Profile unavailable." };
  }
  async function connectErpPassword(usr, pwd) {
    const response = await sendRuntimeMessage({ type: "CONNECT_ERP", usr, pwd });
    if (response?.type !== "CONNECT_ERP") {
      return { ok: false, error: "Reload this page — Faye was updated." };
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
    const response = await sendRuntimeMessage({
      type: "CONNECT_ERP",
      tmpId,
      otp,
      usr
    });
    if (response?.type !== "CONNECT_ERP") {
      return { ok: false, error: "Reload this page — Faye was updated." };
    }
    if (!response.ok)
      return { ok: false, error: response.error };
    if (response.needsOtp) {
      return { ok: false, error: "Still waiting for verification." };
    }
    return { ok: true, connection: response.connection };
  }
  async function connectErpFromDesk() {
    const response = await sendRuntimeMessage({ type: "CONNECT_ERP_DESK" });
    if (response?.type !== "CONNECT_ERP") {
      return { ok: false, error: "Reload this page — Faye was updated." };
    }
    if (!response.ok)
      return { ok: false, error: response.error };
    if (response.needsOtp) {
      return { ok: false, error: "Unexpected OTP step." };
    }
    return { ok: true, connection: response.connection };
  }
  async function disconnectErp() {
    await sendRuntimeMessage({ type: "DISCONNECT_ERP" });
  }

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

  // src/shared/avatar.ts
  function initialsAvatarUrl(nameOrEmail) {
    const label = (nameOrEmail || "?").trim();
    const parts = label.split(/[\s@._-]+/).filter(Boolean);
    const initials = (parts.length >= 2 ? `${parts[0][0] || ""}${parts[1][0] || ""}` : (parts[0] || "?").slice(0, 2)).toUpperCase();
    const tone = 28 + Math.abs(Array.from(label).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 40;
    const bg = `hsl(0 0% ${tone}%)`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="32" fill="${bg}"/>
    <text x="32" y="34" text-anchor="middle" dominant-baseline="middle"
      font-family="system-ui,Segoe UI,sans-serif" font-size="22" font-weight="600" fill="#fff">${escapeXml(initials)}</text>
  </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  function avatarFallbackUrl(nameOrEmail) {
    const name = (nameOrEmail || "").trim();
    if (name)
      return initialsAvatarUrl(name);
    return defaultIconUrl();
  }
  function escapeXml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // src/content/concern-client.ts
  async function listConcerns(force = false) {
    const response = await sendRuntimeMessage({ type: "LIST_CONCERNS", force });
    if (response?.type === "CONCERNS") {
      if (response.ok)
        return { ok: true, concerns: response.concerns };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Faye was updated." };
  }
  async function createConcern(input) {
    const response = await sendRuntimeMessage({
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
    return { ok: false, error: "Reload this page — Faye was updated." };
  }
  async function listPagePins(href) {
    const response = await sendRuntimeMessage({ type: "LIST_PAGE_PINS", href });
    if (response?.type === "PAGE_PINS") {
      if (response.ok)
        return { ok: true, pins: response.pins };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Faye was updated." };
  }
  async function addConcernPin(concernName, pin) {
    const response = await sendRuntimeMessage({
      type: "ADD_CONCERN_PIN",
      concernName,
      pin
    });
    if (response?.type === "PIN_SAVED") {
      if (response.ok)
        return { ok: true, commentName: response.commentName };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Faye was updated." };
  }
  async function listPinThread(concernName, threadId) {
    const response = await sendRuntimeMessage({
      type: "LIST_PIN_THREAD",
      concernName,
      threadId
    });
    if (response?.type === "PIN_THREAD") {
      if (response.ok)
        return { ok: true, comments: response.comments };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Faye was updated." };
  }
  async function getConcernDevops(concernName) {
    const response = await sendRuntimeMessage({
      type: "GET_CONCERN_DEVOPS",
      concernName
    });
    if (response?.type === "CONCERN_DEVOPS") {
      if (response.ok) {
        return {
          ok: true,
          devopsStatus: response.devopsStatus,
          resolved: response.resolved
        };
      }
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Faye was updated." };
  }
  async function resolveConcern(concernName) {
    const response = await sendRuntimeMessage({
      type: "RESOLVE_CONCERN",
      concernName
    });
    if (response?.type === "CONCERN_DEVOPS") {
      if (response.ok) {
        return {
          ok: true,
          devopsStatus: response.devopsStatus,
          resolved: response.resolved
        };
      }
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Faye was updated." };
  }
  async function uploadErpFile(input) {
    const maxBytes = 4 * 1024 * 1024;
    if (input.file.size > maxBytes) {
      return { ok: false, error: "Image too large (max 4 MB)." };
    }
    const buffer = await input.file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 32768;
    for (let i = 0;i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const response = await sendRuntimeMessage({
      type: "UPLOAD_ERP_FILE",
      filename: input.file.name || "image.png",
      mimeType: input.file.type || "application/octet-stream",
      base64: btoa(binary),
      doctype: input.doctype,
      docname: input.docname,
      isPrivate: input.isPrivate
    });
    if (response?.type === "ERP_FILE") {
      if (response.ok) {
        return { ok: true, fileUrl: response.fileUrl, fileName: response.fileName };
      }
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Faye was updated." };
  }
  async function fetchErpFileDataUrl(url) {
    const response = await sendRuntimeMessage({
      type: "FETCH_ERP_FILE_DATA",
      url
    });
    if (response?.type === "ERP_FILE_DATA") {
      if (response.ok)
        return { ok: true, dataUrl: response.dataUrl };
      return { ok: false, error: response.error };
    }
    return { ok: false, error: "Reload this page — Faye was updated." };
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

  // lib/domain/usecases/concern/sanitize_comment_html.usecase.ts
  var ALLOWED_TAG = /^(?:a|b|blockquote|br|code|div|em|h1|h2|h3|i|img|li|ol|p|pre|s|span|strong|strike|u|ul)$/i;
  function decodeEntities(value) {
    return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  }
  function commentHtmlToPlainText(html) {
    return decodeEntities(String(html || "").replace(/<br\s*\/?>/gi, `
`).replace(/<\/p>/gi, `
`).replace(/<[^>]+>/g, "")).replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, `
`).replace(/\n{3,}/g, `

`).trim();
  }
  function isBlankCommentHtml(html) {
    return !commentHtmlToPlainText(html);
  }
  function sanitizeOpenTag(raw) {
    const match = raw.match(/^<\s*([a-z0-9]+)([^>]*)>/i);
    if (!match)
      return "";
    const tag = match[1].toLowerCase();
    if (!ALLOWED_TAG.test(tag))
      return "";
    if (tag === "br")
      return "<br>";
    const attrs = match[2] || "";
    const kept = [];
    if (tag === "a") {
      const href = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const value = (href?.[2] || href?.[3] || href?.[4] || "").trim();
      if (/^(https?:|mailto:|\/|#)/i.test(value)) {
        kept.push(`href="${value.replaceAll('"', "")}"`);
        kept.push('target="_blank"');
        kept.push('rel="noopener noreferrer"');
      }
    }
    if (tag === "img") {
      const src = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const value = (src?.[2] || src?.[3] || src?.[4] || "").trim();
      if (/^(https?:|\/)/i.test(value) || /^data:image\//i.test(value)) {
        kept.push(`src="${value.replaceAll('"', "")}"`);
      } else {
        return "";
      }
      const alt = attrs.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i);
      if (alt)
        kept.push(`alt="${(alt[2] || alt[3] || "").replaceAll('"', "")}"`);
      const width = attrs.match(/\bwidth\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const widthVal = (width?.[2] || width?.[3] || width?.[4] || "").trim();
      if (/^\d{1,4}(px)?$/i.test(widthVal)) {
        kept.push(`width="${widthVal.replace(/px$/i, "")}"`);
      }
      const style = attrs.match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
      const styleRaw = style?.[2] || style?.[3] || "";
      const widthMatch = styleRaw.match(/(?:^|;)\s*width\s*:\s*(\d{1,4})px/i);
      const parts = ["max-width:100%", "height:auto"];
      if (widthMatch?.[1])
        parts.unshift(`width:${widthMatch[1]}px`);
      else if (widthVal)
        parts.unshift(`width:${widthVal.replace(/px$/i, "")}px`);
      kept.push(`style="${parts.join(";")}"`);
    }
    return kept.length ? `<${tag} ${kept.join(" ")}>` : `<${tag}>`;
  }
  function sanitizeCommentHtml(html) {
    let out = String(html || "");
    out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
    out = out.replace(/<!--[\s\S]*?-->/g, "");
    out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    out = out.replace(/javascript:/gi, "");
    out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tag, rest) => {
      const name = tag.toLowerCase();
      if (full.startsWith("</")) {
        return ALLOWED_TAG.test(name) ? `</${name}>` : "";
      }
      if (full.endsWith("/>") || name === "br" || name === "img") {
        const open = sanitizeOpenTag(`<${name}${rest}>`);
        return open;
      }
      return sanitizeOpenTag(`<${name}${rest}>`);
    });
    return out.trim();
  }

  // src/content/widget/image-preview.ts
  var previewCache = new Map;
  function needsErpProxy(src) {
    if (!src || src.startsWith("data:") || src.startsWith("blob:"))
      return false;
    try {
      const url = new URL(src, "https://erp.livro.systems");
      if (url.hostname.includes("livro.systems"))
        return true;
      return src.includes("/private/files/") || src.startsWith("/files/");
    } catch {
      return src.includes("/private/files/");
    }
  }
  async function hydrateErpImages(root) {
    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(images.map(async (img) => {
      const src = img.getAttribute("src") || "";
      const erpSrc = img.getAttribute("data-erp-src") || src;
      if (!needsErpProxy(erpSrc))
        return;
      img.setAttribute("data-erp-src", erpSrc);
      const cached = previewCache.get(erpSrc);
      if (cached) {
        img.src = cached;
        return;
      }
      img.classList.add("giya-img-loading");
      const result = await fetchErpFileDataUrl(erpSrc);
      img.classList.remove("giya-img-loading");
      if (!result.ok) {
        img.classList.add("giya-img-broken");
        return;
      }
      previewCache.set(erpSrc, result.dataUrl);
      img.src = result.dataUrl;
      img.classList.remove("giya-img-broken");
    }));
  }

  // src/content/widget/rich-editor.ts
  function toolbarButton(cmd, label, title) {
    return `<button type="button" data-cmd="${cmd}" class="giya-rte-btn" title="${title}" aria-label="${title}">${label}</button>`;
  }
  function exportEditorHtml(editor) {
    const clone = editor.cloneNode(true);
    clone.querySelectorAll(".giya-img-resize").forEach((node) => node.remove());
    clone.querySelectorAll("img").forEach((img) => {
      const erp = img.getAttribute("data-erp-src");
      if (erp)
        img.setAttribute("src", erp);
      img.removeAttribute("data-erp-src");
      img.classList.remove("giya-img-selected", "giya-img-loading", "giya-img-broken");
      const width = img.style.width || img.getAttribute("width");
      if (width) {
        const px = String(width).replace(/px$/i, "");
        if (/^\d+$/.test(px)) {
          img.setAttribute("width", px);
          img.style.width = `${px}px`;
          img.style.maxWidth = "100%";
          img.style.height = "auto";
        }
      }
    });
    return sanitizeCommentHtml(clone.innerHTML);
  }
  function mountRichCommentEditor(host, opts = {}) {
    host.innerHTML = `
    <div class="giya-rte" data-giya-rte>
      <div class="giya-rte-toolbar" role="toolbar" aria-label="Comment formatting">
        ${toolbarButton("bold", "<b>B</b>", "Bold")}
        ${toolbarButton("italic", "<i>I</i>", "Italic")}
        ${toolbarButton("underline", "<u>U</u>", "Underline")}
        ${toolbarButton("strikeThrough", "<s>S</s>", "Strikethrough")}
        <span class="giya-rte-sep" aria-hidden="true"></span>
        ${toolbarButton("insertUnorderedList", "•", "Bullet list")}
        ${toolbarButton("insertOrderedList", "1.", "Numbered list")}
        ${toolbarButton("formatBlock:blockquote", "“", "Quote")}
        <span class="giya-rte-sep" aria-hidden="true"></span>
        ${toolbarButton("createLink", "\uD83D\uDD17", "Link")}
        <button type="button" data-cmd="image" class="giya-rte-btn" title="Upload image" aria-label="Upload image">${ICONS.image}</button>
      </div>
      <div
        data-rte-editor
        class="giya-rte-editor"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        data-placeholder="${opts.placeholder || "Comment here…"}"
      ></div>
      <input data-rte-file type="file" accept="image/*" class="hidden" hidden />
    </div>
  `;
    const editor = host.querySelector("[data-rte-editor]");
    const fileInput = host.querySelector("[data-rte-file]");
    const toolbar = host.querySelector(".giya-rte-toolbar");
    let selectedImg = null;
    const run = (command, value) => {
      editor.focus();
      try {
        document.execCommand(command, false, value);
      } catch {}
      syncToolbarState();
    };
    const queryActive = (cmd) => {
      try {
        if (cmd.startsWith("formatBlock:")) {
          const tag = (cmd.split(":")[1] || "").toLowerCase();
          const block = String(document.queryCommandValue("formatBlock") || "").replace(/[<>]/g, "").toLowerCase();
          return Boolean(tag && block === tag);
        }
        if (cmd === "createLink" || cmd === "image")
          return false;
        return document.queryCommandState(cmd);
      } catch {
        return false;
      }
    };
    const syncToolbarState = () => {
      for (const btn of toolbar.querySelectorAll("[data-cmd]")) {
        const cmd = btn.dataset.cmd || "";
        const on = queryActive(cmd);
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      }
    };
    const clearImageSelection = () => {
      editor.querySelectorAll(".giya-img-selected").forEach((el) => {
        el.classList.remove("giya-img-selected");
      });
      editor.querySelectorAll(".giya-img-resize").forEach((el) => el.remove());
      selectedImg = null;
    };
    const selectImage = (img) => {
      clearImageSelection();
      selectedImg = img;
      img.classList.add("giya-img-selected");
      const handle = document.createElement("span");
      handle.className = "giya-img-resize";
      handle.contentEditable = "false";
      handle.title = "Drag to resize";
      img.insertAdjacentElement("afterend", handle);
      const onMove = (event) => {
        if (!selectedImg)
          return;
        const rect = selectedImg.getBoundingClientRect();
        const next = Math.max(80, Math.min(editor.clientWidth - 8, event.clientX - rect.left));
        selectedImg.style.width = `${Math.round(next)}px`;
        selectedImg.style.height = "auto";
        selectedImg.setAttribute("width", String(Math.round(next)));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      });
    };
    const insertImageFromFile = async (file, statusText) => {
      opts.onStatus?.(statusText);
      const localUrl = URL.createObjectURL(file);
      const alt = file.name.replaceAll('"', "");
      const before = new Set(editor.querySelectorAll("img"));
      run("insertHTML", `<p><img src="${localUrl}" alt="${alt}" width="280" style="width:280px;max-width:100%;height:auto"></p><p><br></p>`);
      const img = Array.from(editor.querySelectorAll("img")).find((node) => !before.has(node)) || null;
      if (img)
        selectImage(img);
      const result = await uploadErpFile({
        file,
        doctype: opts.concernName ? "Sprint Backlogs" : undefined,
        docname: opts.concernName,
        isPrivate: false
      });
      if (!result.ok) {
        opts.onStatus?.(result.error);
        return;
      }
      const erpUrl = result.fileUrl.replaceAll('"', "");
      if (img?.isConnected) {
        img.setAttribute("data-erp-src", erpUrl);
        hydrateErpImages(editor);
      }
      opts.onStatus?.("Image attached — click it, drag the corner to resize.");
    };
    toolbar.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    toolbar.addEventListener("click", (event) => {
      const btn = event.target?.closest("[data-cmd]");
      if (!btn)
        return;
      const cmd = btn.dataset.cmd || "";
      if (cmd === "createLink") {
        const url = window.prompt("Link URL", "https://");
        if (url)
          run("createLink", url.trim());
        return;
      }
      if (cmd === "image") {
        fileInput.click();
        return;
      }
      if (cmd.startsWith("formatBlock:")) {
        run("formatBlock", cmd.split(":")[1] || "p");
        return;
      }
      run(cmd);
    });
    editor.addEventListener("keyup", syncToolbarState);
    editor.addEventListener("mouseup", syncToolbarState);
    editor.addEventListener("focus", syncToolbarState);
    document.addEventListener("selectionchange", () => {
      if (!host.isConnected)
        return;
      if (!editor.contains(document.getSelection()?.anchorNode ?? null))
        return;
      syncToolbarState();
    });
    editor.addEventListener("click", (event) => {
      const img = event.target?.closest("img");
      if (img && editor.contains(img)) {
        event.preventDefault();
        selectImage(img);
        return;
      }
      if (!event.target?.closest(".giya-img-resize")) {
        clearImageSelection();
      }
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file)
        return;
      insertImageFromFile(file, "Uploading image to Livro…");
    });
    editor.addEventListener("paste", (event) => {
      const item = Array.from(event.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
      if (!item)
        return;
      const file = item.getAsFile();
      if (!file)
        return;
      event.preventDefault();
      insertImageFromFile(file, "Uploading pasted image…");
    });
    return {
      getHtml: () => exportEditorHtml(editor),
      setDisabled: (disabled) => {
        editor.contentEditable = disabled ? "false" : "true";
        toolbar.querySelectorAll("button").forEach((b) => {
          b.disabled = disabled;
        });
      },
      clear: () => {
        clearImageSelection();
        editor.innerHTML = "";
        syncToolbarState();
      },
      focus: () => editor.focus()
    };
  }
  function richEditorHasContent(html) {
    return !isBlankCommentHtml(html);
  }

  // src/content/widget/panels/comment.ts
  function renderCommentPanel(els, concern, picked, host) {
    const rect = picked.element.getBoundingClientRect();
    host.renderDraftPin(rect);
    els.panelTitle.textContent = "Comment";
    els.panelBody.innerHTML = `
      <div class="space-y-3">
        <div class="rounded-xl border border-black/8 bg-white/50 px-2.5 py-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Concern</p>
          <p class="mt-0.5 font-mono text-[10px] font-semibold text-neutral-700">${escapeHtml(concern.name)}</p>
          <p class="mt-0.5 line-clamp-2 text-xs font-medium text-neutral-900">${escapeHtml(concern.subject)}</p>
          <button type="button" data-change-concern class="mt-2 text-xs font-medium text-neutral-700 underline-offset-2 hover:underline">
            Change concern
          </button>
        </div>
        <div class="rounded-xl border border-black/8 bg-white/50 px-2.5 py-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Pinned to</p>
          <p class="mt-0.5 break-all text-xs font-medium text-neutral-900">${escapeHtml(picked.label)}</p>
          <button type="button" data-retarget class="mt-2 text-xs font-medium text-neutral-700 underline-offset-2 hover:underline">
            Change element
          </button>
        </div>
        <div data-comment-editor-host></div>
        <div class="flex items-center justify-between gap-2">
          <p data-comment-status class="text-xs text-neutral-500">HTML comment → Livro SPB (images upload like Desk).</p>
          <button
            type="button"
            data-comment-submit
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md transition hover:bg-neutral-800"
            aria-label="Send comment"
          >
            ${ICONS.send}
          </button>
        </div>
      </div>
    `;
    const submitBtn = els.panelBody.querySelector("[data-comment-submit]");
    const status = els.panelBody.querySelector("[data-comment-status]");
    const editorHost = els.panelBody.querySelector("[data-comment-editor-host]");
    const editor = editorHost ? mountRichCommentEditor(editorHost, {
      placeholder: "Write a comment…",
      concernName: concern.name,
      onStatus: (message) => {
        if (status)
          status.textContent = message;
      }
    }) : null;
    els.panelBody.querySelector("[data-change-concern]")?.addEventListener("click", () => {
      host.onChangeConcern();
    });
    els.panelBody.querySelector("[data-retarget]")?.addEventListener("click", () => {
      host.onRetarget();
    });
    const sendIdle = ICONS.send;
    submitBtn?.addEventListener("click", () => {
      (async () => {
        const html = editor?.getHtml() ?? "";
        if (!richEditorHasContent(html)) {
          if (status)
            status.textContent = "Write something first.";
          return;
        }
        if (status)
          status.innerHTML = loadingMarkup("Saving to Livro…");
        setButtonBusy(submitBtn, true, sendIdle);
        editor?.setDisabled(true);
        const result = await addConcernPin(concern.name, {
          v: 1,
          href: location.href,
          selector: picked.selector,
          label: picked.label,
          tagName: picked.tagName,
          text: html,
          threadId: crypto.randomUUID(),
          envSpecs: collectEnvSpecs()
        });
        if (!result.ok) {
          setButtonBusy(submitBtn, false, sendIdle);
          editor?.setDisabled(false);
          if (status)
            status.textContent = result.error;
          return;
        }
        editor?.clear();
        if (status)
          status.innerHTML = loadingMarkup("Refreshing pins…");
        await host.onSaved();
      })();
    });
    editor?.focus();
  }

  // src/content/widget/panels/concerns.ts
  async function renderConcernsPanel(els, host, options = {}) {
    host.markConcernsActive();
    host.syncDockActive();
    els.panelTitle.textContent = "Concerns";
    els.panelBody.innerHTML = loadingMarkup(options.force ? "Refreshing concerns…" : "Loading concerns…");
    host.showPanelVisual();
    const result = await listConcerns(Boolean(options.force));
    if (!result.ok) {
      els.panelBody.innerHTML = `
        <div class="space-y-3">
          <p class="text-xs leading-relaxed text-neutral-600">${escapeHtml(result.error)}</p>
          <button
            type="button"
            data-retry-concerns
            class="flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-medium text-neutral-800 transition hover:bg-white"
          >
            ${ICONS.refresh}
            Retry
          </button>
        </div>
      `;
      els.panelBody.querySelector("[data-retry-concerns]")?.addEventListener("click", () => {
        renderConcernsPanel(els, host, { force: true });
      });
      return;
    }
    const onForm = concernNameFromLocation();
    if (onForm) {
      const match = result.concerns.find((c) => c.name === onForm);
      if (match) {
        host.onSelectConcern(match);
        return;
      }
    }
    const sprintLabel = result.concerns[0]?.sprintAssign || "latest sprint";
    const listMarkup = result.concerns.length === 0 ? `<p class="text-xs leading-relaxed text-neutral-600">
            No open concerns yet. Tap <span class="font-medium">+</span> to create a task for QA on this page.
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
              <p class="font-mono text-[10px] font-semibold text-neutral-700">${escapeHtml(c.name)}</p>
              <p class="mt-0.5 line-clamp-2 text-xs font-medium text-neutral-900">${escapeHtml(c.subject)}</p>
              <p class="mt-1 text-[10px] text-neutral-500">${escapeHtml(c.type)} · ${escapeHtml(c.status)}${c.sprintAssign ? ` · ${escapeHtml(c.sprintAssign)}` : ""}</p>
            </button>
          </li>`).join("")}
      </ul>`;
    els.panelBody.innerHTML = `
      <div class="mb-3 flex items-center justify-between gap-2">
        <p class="text-xs text-neutral-500">Your open concerns</p>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            data-refresh-concerns
            class="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white/70 text-neutral-800 transition hover:bg-white"
            aria-label="Refresh concerns"
            title="Refresh"
          >
            ${ICONS.refresh}
          </button>
          <button
            type="button"
            data-new-task
            class="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-neutral-900 text-white transition hover:bg-neutral-800"
            aria-label="New task"
            title="New task"
          >
            ${ICONS.plus}
          </button>
        </div>
      </div>
      ${listMarkup}
    `;
    els.panelBody.querySelector("[data-refresh-concerns]")?.addEventListener("click", () => {
      renderConcernsPanel(els, host, { force: true });
    });
    els.panelBody.querySelector("[data-new-task]")?.addEventListener("click", () => {
      host.onNewTask();
    });
    for (const btn of els.panelBody.querySelectorAll("[data-concern]")) {
      btn.addEventListener("click", () => {
        const name = btn.dataset.concern;
        const concern = result.concerns.find((c) => c.name === name) || null;
        if (!concern)
          return;
        host.onSelectConcern(concern);
      });
    }
  }

  // src/content/widget/panels/environment.ts
  function renderEnvironmentPanel(els) {
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

  // src/content/widget/panels/login.ts
  function renderLoginPanel(els, host) {
    els.panelTitle.textContent = "Connect Livro";
    const otpMode = Boolean(host.otpTmpId);
    els.panelBody.innerHTML = otpMode ? `
      <div class="space-y-3">
        <p class="text-xs leading-relaxed text-neutral-600">
          Enter the verification code sent to your email (same as Desk OTP).
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
        <button type="button" data-back-login class="w-full text-xs font-medium text-neutral-700 underline-offset-2 hover:underline">
          Back to email / password
        </button>
        <p data-auth-status class="text-xs text-neutral-500"></p>
      </div>` : `
      <div class="space-y-3">
        <p class="text-xs leading-relaxed text-neutral-600">
          Connect Faye to Livro with your ERP login (explicit session — not silent cookie reuse).
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
        <p data-auth-status class="text-xs text-neutral-500"></p>
      </div>`;
    const status = els.panelBody.querySelector("[data-auth-status]");
    host.focusPanelField(otpMode ? "[data-otp]" : "[data-password]");
    els.panelBody.querySelector("[data-back-login]")?.addEventListener("click", () => {
      host.setOtpTmpId(null);
      host.renderAgain();
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
        host.setPendingLoginEmail(email);
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
          host.setOtpTmpId(result.tmpId);
          host.renderAgain();
          const nextStatus = els.panelBody.querySelector("[data-auth-status]");
          if (nextStatus)
            nextStatus.textContent = result.prompt;
          return;
        }
        const ok = await host.refreshSession(true);
        if (!ok) {
          if (status)
            status.textContent = "Connected but session not ready. Retry.";
          return;
        }
        host.refreshPagePins(true);
        host.setPanel("concerns");
      })();
    });
    const submitOtp = els.panelBody.querySelector("[data-submit-otp]");
    submitOtp?.addEventListener("click", () => {
      (async () => {
        const otp = els.panelBody.querySelector("[data-otp]")?.value.trim() || "";
        if (!host.otpTmpId || !otp) {
          if (status)
            status.textContent = "Enter the verification code.";
          return;
        }
        if (status)
          status.innerHTML = loadingMarkup("Verifying…");
        setButtonBusy(submitOtp, true, `${ICONS.login} Verify & connect`);
        const result = await connectErpOtp(host.otpTmpId, otp, host.pendingLoginEmail);
        setButtonBusy(submitOtp, false, `${ICONS.login} Verify & connect`);
        if (!result.ok) {
          if (status)
            status.textContent = result.error;
          return;
        }
        host.setOtpTmpId(null);
        const ok = await host.refreshSession(true);
        if (!ok) {
          if (status)
            status.textContent = "Connected but session not ready. Retry.";
          return;
        }
        host.refreshPagePins(true);
        host.setPanel("concerns");
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
        const ok = await host.refreshSession(true);
        if (!ok) {
          if (status)
            status.textContent = "Connected but session not ready. Retry.";
          return;
        }
        host.refreshPagePins(true);
        host.setPanel("concerns");
      })();
    });
  }

  // src/content/widget/panels/new-task.ts
  function renderNewTaskPanel(els, host) {
    els.panelTitle.textContent = "New task";
    els.panelBody.innerHTML = `
      <div class="space-y-3">
        <p class="text-xs leading-relaxed text-neutral-600">
          Creates an open Sprint Backlog on the latest R&amp;D sprint, assigned to you.
        </p>
        <input
          type="text"
          data-create-subject
          placeholder="Subject (e.g. QA: pin misaligned on …)"
          class="w-full rounded-lg border border-black/10 bg-white/70 px-2.5 py-1.5 text-xs text-neutral-900 outline-none ring-neutral-900 placeholder:text-neutral-400 focus:ring-2"
        />
        <select
          data-create-type
          class="w-full rounded-lg border border-black/10 bg-white/70 px-2 py-1.5 text-xs text-neutral-800 outline-none ring-neutral-900 focus:ring-2"
        >
          <option value="Bugs/Issues" selected>Bugs/Issues</option>
          <option value="Feature Request">Feature Request</option>
        </select>
        <button
          type="button"
          data-create-spb
          class="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-neutral-800"
        >
          ${ICONS.plus}
          Create
        </button>
        <p data-create-status class="min-h-4 text-[10px] text-neutral-500"></p>
      </div>
    `;
    host.showPanelVisual();
    host.focusPanelField("[data-create-subject]");
    const subjectInput = els.panelBody.querySelector("[data-create-subject]");
    const typeSelect = els.panelBody.querySelector("[data-create-type]");
    const createBtn = els.panelBody.querySelector("[data-create-spb]");
    const createStatus = els.panelBody.querySelector("[data-create-status]");
    const idleHtml = `${ICONS.plus} Create`;
    const runCreate = () => {
      (async () => {
        const subject = subjectInput?.value.trim() || "";
        if (!subject) {
          if (createStatus)
            createStatus.textContent = "Enter a subject.";
          return;
        }
        if (createStatus)
          createStatus.innerHTML = loadingMarkup("Creating…");
        setButtonBusy(createBtn, true, idleHtml);
        const created = await createConcern({
          subject,
          type: typeSelect?.value || "Bugs/Issues",
          description: `<p>Created from Faye on <a href="${escapeHtml(location.href)}">${escapeHtml(location.href)}</a></p>`
        });
        if (!created.ok) {
          if (createStatus)
            createStatus.textContent = created.error;
          setButtonBusy(createBtn, false, idleHtml);
          return;
        }
        host.onCreated(created.concern);
      })();
    };
    createBtn?.addEventListener("click", runCreate);
    subjectInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runCreate();
      }
    });
  }

  // src/content/widget/panels/profile.ts
  async function renderProfilePanel(els, host) {
    els.panelTitle.textContent = "Profile";
    els.panelBody.innerHTML = loadingMarkup("Loading profile…");
    host.showPanelVisual();
    const profile = await host.ensureProfile(true);
    if (!profile) {
      els.panelBody.innerHTML = `<p class="text-xs text-neutral-600">Could not load profile.</p>`;
      return;
    }
    const avatar = host.avatarUrl();
    els.panelBody.innerHTML = `
      <div class="flex flex-col items-center gap-3 text-center">
        <img src="${escapeHtml(avatar)}" alt="" class="h-16 w-16 rounded-full object-cover shadow-md ring-2 ring-white" />
        <div>
          <p class="text-sm font-semibold text-neutral-900">${escapeHtml(profile.fullName)}</p>
          <p class="mt-0.5 break-all text-xs text-neutral-500">${escapeHtml(profile.email)}</p>
        </div>
        <p class="w-full break-all rounded-xl border border-black/5 bg-white/50 px-2.5 py-2 text-left font-mono text-[10px] text-neutral-500">
          ${escapeHtml(profile.userName)}
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
        img.onerror = null;
        img.src = avatarFallbackUrl(profile.fullName || profile.email);
      };
    }
    els.panelBody.querySelector("[data-disconnect]")?.addEventListener("click", () => {
      (async () => {
        await disconnectErp();
        host.onDisconnected();
      })();
    });
  }

  // src/content/widget/theme.ts
  function applyGiyaTheme(root, theme) {
    root.dataset.giyaTheme = theme;
  }

  // lib/entities/erpnext.type.ts
  var ERP_HOST = "erp.livro.systems";
  var ERP_BASE_URL = `https://${ERP_HOST}`;

  // lib/domain/usecases/concern/list_pin_thread.usecase.ts
  function pinThreadId(commentName, pin) {
    return String(pin.threadId || "").trim() || commentName;
  }

  // src/content/widget/panels/pin-thread.ts
  function shortId(name) {
    return name.length > 10 ? name.slice(-8) : name;
  }
  function threadItemHtml(item, depth) {
    const body = sanitizeCommentHtml(item.pin.text);
    const indent = Math.min(depth, 3) * 12;
    const reply = Boolean(item.pin.parentId);
    return `
    <article
      data-thread-comment="${escapeHtml(item.commentName)}"
      class="rounded-xl border border-black/8 bg-white/50 px-2.5 py-2 ${reply ? "ml-3 border-l-2 border-l-neutral-400/70" : ""}"
      style="margin-left:${indent}px"
    >
      <div class="flex items-start gap-2">
        <img
          src="${escapeHtml(avatarFallbackUrl(item.commentBy || item.commentEmail))}"
          alt=""
          class="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"
          data-thread-avatar
        />
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span class="text-xs font-medium text-neutral-900">${escapeHtml(item.commentBy)}</span>
            <span class="font-mono text-[10px] text-neutral-400" title="${escapeHtml(item.commentName)}">#${escapeHtml(shortId(item.commentName))}</span>
          </div>
          <div class="giya-comment-html text-sm text-neutral-800">${body}</div>
          <button
            type="button"
            data-reply-to="${escapeHtml(item.commentName)}"
            class="text-[11px] font-medium text-neutral-700 underline-offset-2 hover:underline"
          >Reply</button>
        </div>
      </div>
    </article>
  `;
  }
  function buildDepthMap(comments) {
    const byName = new Map(comments.map((c) => [c.commentName, c]));
    const depth = new Map;
    const of = (name, guard = 0) => {
      if (depth.has(name))
        return depth.get(name);
      if (guard > 20)
        return 0;
      const item = byName.get(name);
      if (!item?.pin.parentId || !byName.has(item.pin.parentId)) {
        depth.set(name, 0);
        return 0;
      }
      const d = of(item.pin.parentId, guard + 1) + 1;
      depth.set(name, d);
      return d;
    };
    for (const c of comments)
      of(c.commentName);
    return depth;
  }
  async function renderPinThreadPanel(els, root) {
    const threadId = pinThreadId(root.commentName, root.pin);
    els.panelTitle.textContent = root.concernName;
    els.panelBody.innerHTML = `
    <div class="space-y-3">
      <div class="space-y-2">
        <p class="text-sm font-semibold text-neutral-900">${escapeHtml(root.concernSubject || "Discussion")}</p>
        <div class="flex flex-wrap items-center gap-2">
          <span data-devops-chip class="rounded-full bg-neutral-200/80 px-2 py-0.5 text-[10px] font-medium text-neutral-600">Loading status…</span>
          <button
            type="button"
            data-resolve
            hidden
            class="rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-neutral-800"
          >Mark as resolve</button>
        </div>
        <p data-resolve-status class="text-[11px] text-neutral-500"></p>
      </div>
      <div data-thread-list class="space-y-2">
        ${loadingMarkup("Loading discussion…")}
      </div>
      <div class="space-y-2 border-t border-black/8 pt-2">
        <div data-reply-hint class="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
          <span data-reply-hint-text>Reply in thread</span>
        </div>
        <div data-reply-editor-host></div>
        <div class="flex items-center justify-between gap-2">
          <p data-reply-status class="text-xs text-neutral-500"></p>
          <button
            type="button"
            data-reply-submit
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md transition hover:bg-neutral-800"
            aria-label="Send reply"
          >${ICONS.send}</button>
        </div>
      </div>
    </div>
  `;
    const listEl = els.panelBody.querySelector("[data-thread-list]");
    const chip = els.panelBody.querySelector("[data-devops-chip]");
    const resolveBtn = els.panelBody.querySelector("[data-resolve]");
    const resolveStatus = els.panelBody.querySelector("[data-resolve-status]");
    const replyHint = els.panelBody.querySelector("[data-reply-hint]");
    const replyHintText = els.panelBody.querySelector("[data-reply-hint-text]");
    const replyStatus = els.panelBody.querySelector("[data-reply-status]");
    const submitBtn = els.panelBody.querySelector("[data-reply-submit]");
    const editorHost = els.panelBody.querySelector("[data-reply-editor-host]");
    let replyParentId = null;
    let comments = [root];
    const clearReplyTarget = () => {
      replyParentId = null;
      replyHintText.textContent = "Reply in thread";
      replyHint.querySelector("[data-cancel-reply]")?.remove();
    };
    const setReplyTarget = (commentName) => {
      replyParentId = commentName;
      replyHintText.textContent = `Replying to #${shortId(commentName)}`;
      if (!replyHint.querySelector("[data-cancel-reply]")) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.dataset.cancelReply = "1";
        cancel.className = "text-[11px] font-medium text-neutral-700 underline-offset-2 hover:underline";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", () => clearReplyTarget());
        replyHint.appendChild(cancel);
      }
    };
    const paintDevops = (devopsStatus, resolved) => {
      if (resolved) {
        chip.textContent = devopsStatus || "Resolved";
        chip.className = "rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white";
        resolveBtn.hidden = true;
        resolveStatus.textContent = "";
      } else {
        chip.textContent = "Not resolved";
        chip.className = "rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-800";
        resolveBtn.hidden = false;
      }
    };
    const paintThread = () => {
      const depths = buildDepthMap(comments);
      if (comments.length === 0) {
        listEl.innerHTML = `<p class="text-xs text-neutral-500">No comments yet.</p>`;
        return;
      }
      listEl.innerHTML = comments.map((c) => threadItemHtml(c, depths.get(c.commentName) || 0)).join("");
      for (const img of listEl.querySelectorAll("[data-thread-avatar]")) {
        img.onerror = () => {
          img.onerror = null;
          img.src = avatarFallbackUrl("?");
        };
      }
      listEl.querySelectorAll("[data-reply-to]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.replyTo;
          if (id)
            setReplyTarget(id);
        });
      });
      hydrateErpImages(listEl);
    };
    const reloadThread = async () => {
      const result = await listPinThread(root.concernName, threadId);
      if (!result.ok) {
        listEl.innerHTML = `<p class="text-xs text-neutral-600">${escapeHtml(result.error)}</p>`;
        return;
      }
      comments = result.comments.length ? result.comments : [root];
      paintThread();
    };
    const editor = mountRichCommentEditor(editorHost, {
      placeholder: "Write a reply…",
      concernName: root.concernName,
      onStatus: (message) => {
        replyStatus.textContent = message;
      }
    });
    resolveBtn.addEventListener("click", () => {
      (async () => {
        resolveStatus.textContent = "Updating DevOps status…";
        setButtonBusy(resolveBtn, true, "Mark as resolve");
        const result = await resolveConcern(root.concernName);
        setButtonBusy(resolveBtn, false, "Mark as resolve");
        if (!result.ok) {
          resolveStatus.textContent = result.error;
          return;
        }
        paintDevops(result.devopsStatus, result.resolved);
        resolveStatus.textContent = "Set to For Staging Update.";
      })();
    });
    submitBtn.addEventListener("click", () => {
      (async () => {
        const html = editor.getHtml();
        if (!richEditorHasContent(html)) {
          replyStatus.textContent = "Write a reply first.";
          return;
        }
        replyStatus.innerHTML = loadingMarkup("Sending…");
        setButtonBusy(submitBtn, true, ICONS.send);
        editor.setDisabled(true);
        const result = await addConcernPin(root.concernName, {
          v: 1,
          href: root.pin.href,
          selector: root.pin.selector,
          label: root.pin.label,
          tagName: root.pin.tagName,
          text: html,
          threadId,
          parentId: replyParentId || root.commentName
        });
        setButtonBusy(submitBtn, false, ICONS.send);
        editor.setDisabled(false);
        if (!result.ok) {
          replyStatus.textContent = result.error;
          return;
        }
        editor.clear();
        replyStatus.textContent = "Sent.";
        clearReplyTarget();
        await reloadThread();
      })();
    });
    const devops = await getConcernDevops(root.concernName);
    if (devops.ok)
      paintDevops(devops.devopsStatus, devops.resolved);
    else {
      chip.textContent = "Status unavailable";
      resolveStatus.textContent = devops.error;
    }
    await reloadThread();
    editor.focus();
  }

  // src/content/widget/pins.ts
  function renderPinLoadingBadge(els, show) {
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
  function clearDraftPin(els) {
    els.pinLayer.querySelector("[data-draft-pin]")?.remove();
  }
  function renderDraftPin(els, rect, avatarUrl) {
    clearDraftPin(els);
    const wrap = document.createElement("div");
    wrap.dataset.draftPin = "1";
    wrap.className = "pointer-events-auto absolute";
    wrap.style.left = `${rect.left}px`;
    wrap.style.top = `${Math.max(8, rect.top - 8)}px`;
    wrap.innerHTML = `
      <div class="relative h-8 w-8">
        <img
          src="${escapeHtml(avatarUrl)}"
          alt=""
          class="h-8 w-8 rounded-full object-cover shadow-lg ring-2 ring-white"
        />
        <span class="absolute -right-1 -bottom-1 grid h-4 w-4 place-items-center rounded-full bg-neutral-900 text-[10px] font-bold leading-none text-white ring-2 ring-white">+</span>
      </div>
    `;
    const img = wrap.querySelector("img");
    if (img) {
      img.onerror = () => {
        img.onerror = null;
        img.src = avatarFallbackUrl("?");
      };
    }
    els.pinLayer.appendChild(wrap);
  }
  function renderSavedPins(els, pagePins, profile, avatarUrl, onOpen) {
    for (const node of els.pinLayer.querySelectorAll("[data-saved-pin]")) {
      node.remove();
    }
    for (const item of pagePins) {
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
      const isMe = item.commentEmail === profile?.email || item.commentEmail === profile?.userName;
      const fallback = avatarFallbackUrl(item.commentBy || item.commentEmail);
      const avatar = isMe ? avatarUrl : fallback;
      pin.innerHTML = `
        <button type="button" class="relative h-8 w-8" aria-label="Open pin comment">
          <img src="${escapeHtml(avatar)}" alt="" class="h-8 w-8 rounded-full object-cover shadow-lg ring-2 ring-neutral-900" />
        </button>
      `;
      const img = pin.querySelector("img");
      if (img) {
        img.onerror = () => {
          img.onerror = null;
          img.src = fallback;
        };
      }
      const open = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen(item);
      };
      pin.querySelector("button")?.addEventListener("click", open);
      pin.querySelector("button")?.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      els.pinLayer.appendChild(pin);
    }
  }
  async function fetchPagePins(href) {
    const result = await listPagePins(href);
    return result.ok ? result.pins : [];
  }

  // src/content/widget/types.ts
  var ICON_BTN_CLASS = "grid h-8 w-8 place-items-center rounded-full text-neutral-700 transition hover:bg-black/8 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 data-[active=true]:bg-black data-[active=true]:text-white";

  // src/content/widget/shell.ts
  function widgetShellHtml() {
    return `
      <div data-backdrop class="pointer-events-auto fixed inset-0 bg-black/10 opacity-0 transition-opacity duration-200 ease-out invisible" aria-hidden="true"></div>

      <div
        data-highlight
        class="pointer-events-none fixed z-1 rounded-md border-2 border-neutral-900 bg-neutral-900/10 opacity-0 transition-opacity duration-75"
        hidden
      ></div>

      <div
        data-pick-hint
        class="pointer-events-none fixed bottom-4 left-1/2 z-5 -translate-x-1/2 rounded-full border border-white/50 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-150"
        hidden
      >
        Click an element to comment · Esc to cancel
      </div>

      <div data-pin-layer class="pointer-events-none fixed inset-0 z-3"></div>

      <div
        data-dock
        class="pointer-events-auto fixed z-3 flex flex-col items-center gap-1 rounded-full border border-white/50 bg-white/55 p-1.5 shadow-lg shadow-black/10 backdrop-blur-xl transition duration-200 ease-out scale-95 opacity-0"
        role="toolbar"
        aria-label="Faye"
        hidden
      >
        <button type="button" data-nav class="${ICON_BTN_CLASS}" aria-label="Concerns" title="Concerns" data-active="false" data-mode="concerns">
          ${ICONS.concerns}
        </button>
        <button type="button" data-env class="${ICON_BTN_CLASS}" aria-label="Environment" title="Environment" data-active="false">
          ${ICONS.environment}
        </button>
        <button type="button" data-user class="${ICON_BTN_CLASS}" aria-label="Profile" title="Profile" data-active="false">
          ${ICONS.user}
        </button>
        <button type="button" data-theme class="${ICON_BTN_CLASS}" aria-label="Toggle theme" title="Light mode" data-active="false" aria-pressed="true">
          ${ICONS.sun}
        </button>
        <button type="button" data-pin class="${ICON_BTN_CLASS}" aria-label="Pin toolbar" title="Pin toolbar" data-active="false" aria-pressed="false">
          ${ICONS.pin}
        </button>
      </div>

      <section
        data-panel
        class="pointer-events-auto fixed z-4 flex flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/70 text-neutral-900 shadow-xl shadow-black/10 backdrop-blur-2xl transition duration-200 ease-out scale-95 opacity-0"
        role="dialog"
        aria-label="Faye panel"
        hidden
      >
        <header data-panel-header class="flex shrink-0 cursor-grab items-center gap-2 border-b border-black/5 px-3 py-2 active:cursor-grabbing touch-none select-none">
          <h2 data-panel-title class="flex-1 text-xs font-semibold tracking-tight text-neutral-800"></h2>
          <button type="button" data-close-panel class="${ICON_BTN_CLASS} cursor-pointer" aria-label="Close panel">
            ${ICONS.close}
          </button>
        </header>
        <div data-panel-body class="min-h-0 flex-1 overflow-auto px-3 py-3 text-sm"></div>
        <div
          data-panel-resize
          class="absolute right-0 bottom-0 h-4 w-4 cursor-se-resize touch-none"
          aria-label="Resize panel"
          title="Drag to resize"
        >
          <span class="pointer-events-none absolute right-1 bottom-1 block h-2 w-2 border-r-2 border-b-2 border-neutral-400/80"></span>
        </div>
      </section>

      <button
        type="button"
        data-fab
        class="pointer-events-auto fixed z-2 grid h-8 w-8 place-items-center rounded-full border border-white/40 bg-black p-0 text-white shadow-md transition-transform duration-150 ease-out hover:scale-105 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black cursor-grab active:cursor-grabbing touch-none select-none"
        aria-label="Open Faye"
        aria-expanded="false"
      >
        <span data-fab-logo class="pointer-events-none grid place-items-center">${ICONS.logo}</span>
        <img data-fab-icon class="pointer-events-none hidden h-4 w-4 rounded-full object-cover" alt="" draggable="false" />
      </button>
    `;
  }

  // src/content/widget/floating-widget.ts
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
    pinViewRect = null;
    drag = null;
    panelDrag = null;
    panelResize = null;
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
      root.innerHTML = widgetShellHtml();
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
        panelResize: requireEl(root, "[data-panel-resize]"),
        highlight: requireEl(root, "[data-highlight]"),
        pickHint: requireEl(root, "[data-pick-hint]"),
        pinLayer: requireEl(root, "[data-pin-layer]"),
        fab: requireEl(root, "[data-fab]"),
        fabLogo: requireEl(root, "[data-fab-logo]"),
        fabIcon: requireEl(root, "[data-fab-icon]"),
        btnNav: requireEl(root, "[data-nav]"),
        btnEnv: requireEl(root, "[data-env]"),
        btnUser: requireEl(root, "[data-user]"),
        btnTheme: requireEl(root, "[data-theme]"),
        btnPin: requireEl(root, "[data-pin]"),
        btnClosePanel: requireEl(root, "[data-close-panel]")
      };
      this.applyIcon(this.config.iconUrl);
      this.applyFabCoords(this.config.fabCoords ? clampCoords(this.config.fabCoords) : defaultCoords(this.config.position));
      this.syncPinUi();
      this.applyTheme(this.config.theme || "dark");
      this.bindEvents();
      this.enableKeyShield();
      this.refreshSession().then((ok) => {
        if (ok)
          this.refreshPagePins(false);
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
      els.btnNav.addEventListener("click", () => this.onNavClick());
      els.btnEnv.addEventListener("click", () => this.togglePanel("environment"));
      els.btnUser.addEventListener("click", () => this.onUserClick());
      els.btnTheme.addEventListener("click", () => this.toggleTheme());
      els.btnPin.addEventListener("click", () => this.togglePin());
      els.btnClosePanel.addEventListener("click", () => this.onClosePanelClick());
      els.panelHeader.addEventListener("pointerdown", this.onPanelPointerDown);
      els.panelResize.addEventListener("pointerdown", this.onPanelResizePointerDown);
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
            this.refreshSession(false).then(async (ok) => {
              if (ok)
                return;
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
      if (this.profile?.userImage)
        return this.profile.userImage;
      return avatarFallbackUrl(this.profile?.fullName || this.profile?.email || this.session?.email);
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
      const custom = Boolean(iconUrl && iconUrl.trim());
      this.config.iconUrl = custom ? iconUrl : defaultIconUrl();
      els.fabLogo.hidden = custom;
      els.fabIcon.hidden = !custom;
      if (custom)
        els.fabIcon.src = iconUrl;
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
    panelSize() {
      const maxW = Math.max(MIN_PANEL_WIDTH, window.innerWidth - FAB_MARGIN * 2);
      const maxH = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - FAB_MARGIN * 2);
      const width = Math.min(maxW, Math.max(MIN_PANEL_WIDTH, this.config.panelWidth || DEFAULT_PANEL_WIDTH));
      const height = Math.min(maxH, Math.max(MIN_PANEL_HEIGHT, this.config.panelHeight || DEFAULT_PANEL_HEIGHT));
      return { width, height };
    }
    clampPanelCoords(coords) {
      const { width, height } = this.panelSize();
      const maxLeft = Math.max(FAB_MARGIN, window.innerWidth - width - FAB_MARGIN);
      const maxTop = Math.max(FAB_MARGIN, window.innerHeight - height - FAB_MARGIN);
      return {
        left: Math.min(maxLeft, Math.max(FAB_MARGIN, coords.left)),
        top: Math.min(maxTop, Math.max(FAB_MARGIN, coords.top))
      };
    }
    defaultPanelCoords() {
      const coords = this.config.fabCoords || defaultCoords(this.config.position);
      const { width } = this.panelSize();
      let left = coords.left - width - 12;
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
      const { width, height } = this.panelSize();
      els.panel.style.left = `${next.left}px`;
      els.panel.style.top = `${next.top}px`;
      els.panel.style.width = `${width}px`;
      els.panel.style.height = `${height}px`;
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
    onPanelResizePointerDown = (event) => {
      const els = this.els;
      if (!els || event.button !== 0)
        return;
      event.preventDefault();
      event.stopPropagation();
      const { width, height } = this.panelSize();
      this.panelResize = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originW: width,
        originH: height
      };
      els.panelResize.setPointerCapture(event.pointerId);
      els.panelResize.addEventListener("pointermove", this.onPanelResizePointerMove);
      els.panelResize.addEventListener("pointerup", this.onPanelResizePointerUp);
      els.panelResize.addEventListener("pointercancel", this.onPanelResizePointerUp);
      els.panel.classList.remove("transition", "duration-200", "ease-out");
    };
    onPanelResizePointerMove = (event) => {
      const els = this.els;
      if (!els || !this.panelResize || event.pointerId !== this.panelResize.pointerId) {
        return;
      }
      event.preventDefault();
      const maxW = Math.max(MIN_PANEL_WIDTH, window.innerWidth - FAB_MARGIN * 2);
      const maxH = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - FAB_MARGIN * 2);
      const width = Math.min(maxW, Math.max(MIN_PANEL_WIDTH, this.panelResize.originW + (event.clientX - this.panelResize.startX)));
      const height = Math.min(maxH, Math.max(MIN_PANEL_HEIGHT, this.panelResize.originH + (event.clientY - this.panelResize.startY)));
      this.config.panelWidth = width;
      this.config.panelHeight = height;
      this.applyPanelCoords(this.panelCoords || this.defaultPanelCoords());
    };
    onPanelResizePointerUp = (event) => {
      const els = this.els;
      if (!els || !this.panelResize || event.pointerId !== this.panelResize.pointerId) {
        return;
      }
      els.panelResize.removeEventListener("pointermove", this.onPanelResizePointerMove);
      els.panelResize.removeEventListener("pointerup", this.onPanelResizePointerUp);
      els.panelResize.removeEventListener("pointercancel", this.onPanelResizePointerUp);
      try {
        els.panelResize.releasePointerCapture(event.pointerId);
      } catch {}
      els.panel.classList.add("transition", "duration-200", "ease-out");
      chrome.storage.sync.set({
        panelWidth: this.config.panelWidth,
        panelHeight: this.config.panelHeight
      });
      this.panelResize = null;
    };
    onPanelPointerDown = (event) => {
      const els = this.els;
      if (!els || event.button !== 0)
        return;
      const target = event.target;
      if (target?.closest("[data-close-panel]"))
        return;
      if (target?.closest("[data-panel-resize]"))
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
      fab.setAttribute("aria-label", this.open ? "Close Faye" : "Open Faye");
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
    navIsBackMode() {
      return this.picker.isActive || this.activePanel === "comment" || this.activePanel === "new-task" || this.activePanel === "pin";
    }
    onNavClick() {
      if (this.navIsBackMode()) {
        this.onBackClick();
        return;
      }
      (async () => {
        if (!await this.requireSession())
          return;
        if (this.activePanel === "concerns") {
          this.setPanel(null);
          return;
        }
        this.setPanel("concerns");
      })();
    }
    onClosePanelClick() {
      if (this.navIsBackMode()) {
        this.onBackClick();
        return;
      }
      this.setPanel(null);
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
      const backMode = this.navIsBackMode();
      els.btnNav.dataset.mode = backMode ? "back" : "concerns";
      els.btnNav.innerHTML = backMode ? ICONS.back : ICONS.concerns;
      els.btnNav.title = backMode ? "Back" : "Concerns";
      els.btnNav.setAttribute("aria-label", backMode ? "Back" : "Concerns");
      els.btnNav.dataset.active = String(backMode || this.activePanel === "concerns");
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
        this.renderProfilePanel();
        return;
      } else if (panel === "concerns") {
        this.renderConcernsPanel();
        return;
      } else if (panel === "new-task") {
        this.renderNewTaskPanel();
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
      } else if (panel === "pin") {} else {
        renderEnvironmentPanel(els);
      }
      this.showPanelVisual();
    }
    showPanelVisual() {
      const els = this.els;
      if (!els)
        return;
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
    renderLoginPanel() {
      const els = this.els;
      if (!els)
        return;
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
        renderAgain: () => this.renderLoginPanel()
      });
    }
    async renderProfilePanel() {
      const els = this.els;
      if (!els)
        return;
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
        }
      });
    }
    async renderConcernsPanel() {
      const els = this.els;
      if (!els)
        return;
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
        }
      });
    }
    renderNewTaskPanel() {
      const els = this.els;
      if (!els)
        return;
      renderNewTaskPanel(els, {
        showPanelVisual: () => this.showPanelVisual(),
        focusPanelField: (sel) => this.focusPanelField(sel),
        onCreated: (concern) => {
          this.selectedConcern = concern;
          this.picked = null;
          this.startPicker();
        }
      });
    }
    renderCommentPanel(picked) {
      const els = this.els;
      if (!els || !this.selectedConcern)
        return;
      renderCommentPanel(els, this.selectedConcern, picked, {
        renderDraftPin: (rect) => this.renderDraftPin(rect),
        clearDraftPin: () => this.clearDraftPin(),
        onChangeConcern: () => {
          this.picked = null;
          this.clearDraftPin();
          this.renderConcernsPanel();
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
        }
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
      const els = this.els;
      this.loadingPins = true;
      if (els)
        renderPinLoadingBadge(els, true);
      const href = location.href;
      try {
        this.pinsHref = href;
        this.pagePins = await fetchPagePins(href);
        this.renderSavedPins();
      } finally {
        this.loadingPins = false;
        if (els)
          renderPinLoadingBadge(els, false);
        if (this.pinsReloadQueued || this.pinsHref !== location.href) {
          this.pinsReloadQueued = false;
          this.refreshPagePins(false);
        }
      }
    }
    renderSavedPins() {
      const els = this.els;
      if (!els)
        return;
      renderSavedPins(els, this.pagePins, this.profile, this.avatarUrl(), (item) => {
        this.showSavedPinPopout(item);
      });
    }
    showSavedPinPopout(item) {
      (async () => {
        const els = this.els;
        if (!els)
          return;
        this.anchorCommentToPick = false;
        this.picked = null;
        this.clearDraftPin();
        this.pinViewRect = null;
        try {
          const target = document.querySelector(item.pin.selector);
          if (target)
            this.pinViewRect = target.getBoundingClientRect();
        } catch {
          this.pinViewRect = null;
        }
        this.activePanel = "pin";
        this.syncDockActive();
        this.showPanelVisual();
        await renderPinThreadPanel(els, item);
      })();
    }
    renderDraftPin(rect) {
      const els = this.els;
      if (!els)
        return;
      renderDraftPin(els, rect, this.avatarUrl());
    }
    clearDraftPin() {
      const els = this.els;
      if (!els)
        return;
      clearDraftPin(els);
    }
    clearCommentPin() {
      this.clearDraftPin();
    }
    layoutPinnedPopout(rect) {
      const els = this.els;
      if (!els)
        return;
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
    toggleTheme() {
      const next = this.config.theme === "dark" ? "light" : "dark";
      this.applyTheme(next);
      chrome.storage.sync.set({ theme: next });
    }
    applyTheme(theme) {
      const next = theme === "light" ? "light" : "dark";
      this.config.theme = next;
      const els = this.els;
      if (els)
        applyGiyaTheme(els.root, next);
      this.syncThemeUi();
    }
    syncThemeUi() {
      const els = this.els;
      if (!els)
        return;
      const dark = this.config.theme === "dark";
      els.btnTheme.innerHTML = dark ? ICONS.sun : ICONS.moon;
      els.btnTheme.title = dark ? "Light mode" : "Dark mode";
      els.btnTheme.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      els.btnTheme.setAttribute("aria-pressed", String(dark));
      els.btnTheme.dataset.active = "false";
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
      if (changes.panelWidth || changes.panelHeight) {
        if (changes.panelWidth) {
          this.config.panelWidth = Math.max(MIN_PANEL_WIDTH, Number(changes.panelWidth.newValue) || DEFAULT_PANEL_WIDTH);
        }
        if (changes.panelHeight) {
          this.config.panelHeight = Math.max(MIN_PANEL_HEIGHT, Number(changes.panelHeight.newValue) || DEFAULT_PANEL_HEIGHT);
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

  // src/content/widget.ts
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

//# debugId=4B8E859F276C3AD564756E2164756E21
//# sourceMappingURL=widget.js.map
