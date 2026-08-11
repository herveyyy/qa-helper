(() => {
  // lib/entities/erpnext.type.ts
  var ERP_BASE_URL = "https://erp.livro.systems";
  function normalizeErpBaseUrl(raw) {
    const value = (raw || ERP_BASE_URL).trim();
    if (!value)
      return null;
    try {
      const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const url = new URL(withProtocol);
      return url.origin.replace(/\/$/, "");
    } catch {
      return null;
    }
  }
  function erpLoginUrl(baseUrl = ERP_BASE_URL) {
    const origin = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
    return `${origin}/login`;
  }

  // lib/entities/giya_connection.type.ts
  var GIYA_CONNECTION_KEY = "giyaErpConnection";

  // lib/domain/usecases/erpnext/erp_fetch.usecase.ts
  async function erpFetch(url, init = {}, timeoutMs = 15000) {
    const controller = new AbortController;
    const timer = setTimeout(() => controller.abort("ERP_TIMEOUT"), timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...init.headers ?? {}
        }
      });
    } finally {
      clearTimeout(timer);
    }
  }
  function erpErrorMessage(error, fallback = "Livro ERP request failed.") {
    if (!(error instanceof Error))
      return fallback;
    const name = error.name;
    const message = error.message || "";
    const cause = String(error.cause ?? "");
    if (name === "AbortError" || name === "TimeoutError" || message.includes("aborted") || message.includes("ERP_TIMEOUT") || cause.includes("ERP_TIMEOUT")) {
      return "Livro ERP timed out. Retry.";
    }
    return message.trim() || fallback;
  }

  // lib/domain/usecases/erpnext/get_logged_user.usecase.ts
  async function getErpLoggedUser(baseUrl, _sid) {
    const site = normalizeErpBaseUrl(baseUrl);
    if (!site)
      return { ok: false, error: "Invalid ERPNext base URL." };
    try {
      const res = await erpFetch(`${site}/api/method/frappe.auth.get_logged_user`);
      if (!res.ok) {
        return { ok: false, error: res.status >= 500 ? "ERP unreachable." : "Session expired." };
      }
      const json = await res.json();
      const email = typeof json.message === "string" ? json.message.trim() : "";
      if (!email || email === "Guest") {
        return { ok: false, error: "Session expired." };
      }
      return { ok: true, data: { email } };
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        return { ok: false, error: `ERP at ${site} timed out while checking sid.` };
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : "ERPNext session check failed."
      };
    }
  }

  // lib/domain/usecases/auth/ensure_erp_sid_cookie.usecase.ts
  async function setCookie(url, name, value, httpOnly) {
    try {
      const result = await chrome.cookies.set({
        url,
        name,
        value,
        path: "/",
        secure: true,
        httpOnly,
        sameSite: "lax"
      });
      return Boolean(result);
    } catch {
      return false;
    }
  }
  async function ensureErpSidCookie(baseUrl, sid, identity = {}) {
    const site = normalizeErpBaseUrl(baseUrl);
    const value = sid.trim();
    if (!site || !value || value === "Guest")
      return false;
    let ok = await setCookie(site, "sid", value, true);
    if (!ok)
      ok = await setCookie(site, "sid", value, false);
    if (identity.userId?.trim()) {
      await setCookie(site, "user_id", identity.userId.trim(), false);
    }
    if (identity.fullName?.trim()) {
      await setCookie(site, "full_name", identity.fullName.trim(), false);
    }
    try {
      const check = await chrome.cookies.get({ url: site, name: "sid" });
      const stored = check?.value?.trim() ?? "";
      return Boolean(stored && stored !== "Guest");
    } catch {
      return ok;
    }
  }

  // lib/domain/usecases/erpnext/extract_sid.usecase.ts
  function extractSidFromSetCookie(headers) {
    const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie")].filter((c) => Boolean(c));
    for (const cookie of cookies) {
      const match = /(?:^|[,\s])sid=([^;,\s]+)/i.exec(cookie);
      const sid = match?.[1] ? decodeURIComponent(match[1]) : null;
      if (sid && sid !== "Guest")
        return sid;
    }
    return null;
  }

  // lib/domain/usecases/erpnext/login_livro.usecase.ts
  async function readErpJson(response) {
    const text = await response.text();
    if (!text)
      return null;
    const trimmed = text.trim();
    if (trimmed.startsWith("<!") || trimmed.startsWith("<html"))
      return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  async function postErpLogin(baseUrl, body, contentType) {
    const headers = { Accept: "application/json" };
    let payload;
    if (contentType === "form") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      payload = new URLSearchParams(body).toString();
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const controller = new AbortController;
    const timer = setTimeout(() => controller.abort("ERP_TIMEOUT"), 12000);
    try {
      const response = await fetch(`${baseUrl}/api/method/login`, {
        method: "POST",
        headers,
        body: payload,
        redirect: "manual",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal
      });
      return { response, erpBody: await readErpJson(response) };
    } finally {
      clearTimeout(timer);
    }
  }
  async function loginLivroErp(input) {
    const baseUrl = normalizeErpBaseUrl(input.baseUrl || ERP_BASE_URL);
    if (!baseUrl)
      return { ok: false, error: "ERP URL is not configured." };
    try {
      let body;
      let emailHint = "";
      if ("tmp_id" in input) {
        if (!input.tmp_id || !input.otp) {
          return { ok: false, error: "Verification code is required." };
        }
        body = { cmd: "login", tmp_id: input.tmp_id, otp: input.otp };
        emailHint = input.usr?.trim() || "";
      } else {
        const usr = input.usr.trim();
        if (!usr || !input.pwd) {
          return { ok: false, error: "Email and password are required." };
        }
        body = { usr, pwd: input.pwd };
        emailHint = usr;
      }
      let { response, erpBody } = await postErpLogin(baseUrl, body, "form");
      if (!erpBody && (response.status === 404 || response.status === 405 || response.status >= 500)) {
        ({ response, erpBody } = await postErpLogin(baseUrl, body, "json"));
      }
      if (erpBody?.tmp_id) {
        return {
          ok: true,
          data: {
            needsOtp: true,
            tmpId: erpBody.tmp_id,
            prompt: erpBody.verification?.prompt ?? "Enter the verification code sent to your email.",
            method: erpBody.verification?.method ?? "Email"
          }
        };
      }
      let sid = extractSidFromSetCookie(response.headers);
      if (!sid) {
        try {
          const existing = await chrome.cookies.get({ url: baseUrl, name: "sid" });
          const value = existing?.value?.trim() ?? "";
          if (value && value !== "Guest")
            sid = value;
        } catch {}
      }
      const looksLoggedIn = Boolean(erpBody?.full_name) || typeof erpBody?.message === "string" && /logged\s*in/i.test(erpBody.message);
      if (!sid) {
        const msg = typeof erpBody?.message === "string" && erpBody.message && !looksLoggedIn ? erpBody.message : "Login succeeded but SID cookie was not set. Retry Connect.";
        return { ok: false, error: msg };
      }
      const fullName = erpBody?.full_name?.trim() || emailHint || "User";
      const email = emailHint || "livro-user";
      await ensureErpSidCookie(baseUrl, sid, { userId: email, fullName });
      return {
        ok: true,
        data: {
          sid,
          fullName,
          baseUrl,
          email
        }
      };
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        return { ok: false, error: `ERP at ${baseUrl} timed out.` };
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : "ERPNext login failed."
      };
    }
  }

  // lib/domain/usecases/auth/read_erp_identity_cookies.usecase.ts
  function decodeCookieValue(raw) {
    if (!raw)
      return null;
    try {
      return decodeURIComponent(raw).trim() || null;
    } catch {
      return raw.trim() || null;
    }
  }
  async function readErpIdentityCookies(baseUrl = ERP_BASE_URL) {
    const site = normalizeErpBaseUrl(baseUrl);
    if (!site)
      return null;
    try {
      const [sidCookie, userIdCookie, fullNameCookie, userImageCookie] = await Promise.all([
        chrome.cookies.get({ url: site, name: "sid" }),
        chrome.cookies.get({ url: site, name: "user_id" }),
        chrome.cookies.get({ url: site, name: "full_name" }),
        chrome.cookies.get({ url: site, name: "user_image" })
      ]);
      const sid = sidCookie?.value?.trim() ?? "";
      if (!sid || sid === "Guest")
        return null;
      return {
        sid,
        userId: decodeCookieValue(userIdCookie?.value),
        fullName: decodeCookieValue(fullNameCookie?.value),
        userImage: decodeCookieValue(userImageCookie?.value)
      };
    } catch {
      return null;
    }
  }

  // lib/domain/usecases/auth/get_extension_session.usecase.ts
  var CACHE_TTL_MS = 45000;
  var memoryCache = null;
  async function getExtensionSession(baseUrl = ERP_BASE_URL, options = {}) {
    const site = normalizeErpBaseUrl(baseUrl);
    if (!site)
      return { ok: false, error: "ERP URL is not configured." };
    if (!options.force && memoryCache && Date.now() - memoryCache.at < CACHE_TTL_MS) {
      return memoryCache.result;
    }
    try {
      const connection = await getGiyaConnection();
      if (!connection) {
        const result2 = {
          ok: false,
          error: "Connect Livro in Giya first."
        };
        memoryCache = { at: Date.now(), result: result2 };
        return result2;
      }
      const origin = normalizeErpBaseUrl(connection.baseUrl) || site;
      let identity = await readErpIdentityCookies(origin);
      if (!identity?.sid && connection.sid) {
        await ensureErpSidCookie(origin, connection.sid, {
          userId: connection.email,
          fullName: connection.fullName
        });
        identity = await readErpIdentityCookies(origin);
      }
      const sid = identity?.sid || connection.sid;
      if (!sid) {
        const result2 = {
          ok: false,
          error: "Login required."
        };
        memoryCache = { at: Date.now(), result: result2 };
        return result2;
      }
      if (identity?.userId) {
        const result2 = {
          ok: true,
          data: {
            email: identity.userId,
            sid,
            baseUrl: origin
          }
        };
        memoryCache = { at: Date.now(), result: result2 };
        return result2;
      }
      const logged = await getErpLoggedUser(origin, sid);
      if (logged.ok) {
        const result2 = {
          ok: true,
          data: {
            email: logged.data.email,
            sid,
            baseUrl: origin
          }
        };
        memoryCache = { at: Date.now(), result: result2 };
        return result2;
      }
      if (logged.error.includes("timed out")) {
        const result2 = {
          ok: true,
          data: {
            email: connection.email,
            sid,
            baseUrl: origin
          }
        };
        memoryCache = { at: Date.now(), result: result2 };
        return result2;
      }
      if (connection.sid) {
        const result2 = {
          ok: true,
          data: {
            email: connection.email,
            sid: connection.sid,
            baseUrl: origin
          }
        };
        memoryCache = { at: Date.now(), result: result2 };
        return result2;
      }
      const result = logged;
      memoryCache = { at: Date.now(), result };
      return result;
    } catch (error) {
      const result = {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read ERP session."
      };
      memoryCache = { at: Date.now(), result };
      return result;
    }
  }
  function clearSessionCache() {
    memoryCache = null;
  }

  // lib/domain/usecases/auth/giya_erp_connection.usecase.ts
  async function getGiyaConnection() {
    const stored = await chrome.storage.local.get(GIYA_CONNECTION_KEY);
    const value = stored[GIYA_CONNECTION_KEY];
    if (!value?.connected || !value.email || !value.baseUrl || !value.sid)
      return null;
    return value;
  }
  async function clearGiyaConnection() {
    await chrome.storage.local.remove(GIYA_CONNECTION_KEY);
    clearSessionCache();
  }
  async function saveConnection(email, fullName, baseUrl, sid) {
    const connection = {
      connected: true,
      email,
      fullName,
      baseUrl,
      sid,
      connectedAt: Date.now()
    };
    await ensureErpSidCookie(baseUrl, sid, { userId: email, fullName });
    await chrome.storage.local.set({ [GIYA_CONNECTION_KEY]: connection });
    clearSessionCache();
    return connection;
  }
  async function connectLivroErp(input) {
    const result = await loginLivroErp(input);
    if (!result.ok)
      return result;
    if ("needsOtp" in result.data && result.data.needsOtp) {
      return {
        ok: true,
        data: {
          needsOtp: true,
          tmpId: result.data.tmpId,
          prompt: result.data.prompt,
          method: result.data.method
        }
      };
    }
    const success = result.data;
    if (!("sid" in success) || !success.sid) {
      return { ok: false, error: "Login failed — no SID returned." };
    }
    await ensureErpSidCookie(success.baseUrl, success.sid, {
      userId: success.email,
      fullName: success.fullName
    });
    const logged = await getErpLoggedUser(success.baseUrl, success.sid);
    const email = logged.ok ? logged.data.email : success.email;
    const connection = await saveConnection(email, success.fullName, success.baseUrl, success.sid);
    return { ok: true, data: { connection } };
  }
  async function connectWithDeskSid(baseUrl = ERP_BASE_URL) {
    const site = normalizeErpBaseUrl(baseUrl);
    if (!site)
      return { ok: false, error: "Invalid ERP URL." };
    const identity = await readErpIdentityCookies(site);
    if (!identity) {
      return { ok: false, error: "No Livro SID in this browser. Sign in below." };
    }
    const logged = await getErpLoggedUser(site, identity.sid);
    const email = logged.ok ? logged.data.email : identity.userId || "";
    if (!email || email === "Guest") {
      return {
        ok: false,
        error: logged.ok ? "Session expired." : logged.error
      };
    }
    const connection = await saveConnection(email, identity.fullName || email, site, identity.sid);
    return { ok: true, data: connection };
  }
  async function disconnectLivroErp() {
    await clearGiyaConnection();
  }

  // lib/domain/usecases/concern/get_latest_sprint_assign.usecase.ts
  async function getLatestSprintAssign(baseUrl) {
    const fromSprint = await trySprintDoctype(baseUrl);
    if (fromSprint.ok)
      return fromSprint;
    const fromSpb = await tryFromSprintBacklogs(baseUrl);
    if (fromSpb.ok)
      return fromSpb;
    return {
      ok: false,
      error: fromSprint.error || fromSpb.error || "No Sprint found."
    };
  }
  async function trySprintDoctype(baseUrl) {
    try {
      const res = await erpFetch(`${baseUrl}/api/method/frappe.client.get_list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Sprint",
          fields: ["name"],
          order_by: "creation desc",
          limit_page_length: 1
        })
      }, 12000);
      if (!res.ok) {
        return { ok: false, error: `Could not load latest sprint (${res.status}).` };
      }
      const json = await res.json();
      const name = Array.isArray(json.message) ? json.message[0]?.name?.trim() : "";
      if (!name) {
        return { ok: false, error: "No Sprint found." };
      }
      return { ok: true, data: name };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Failed to resolve latest sprint.")
      };
    }
  }
  async function tryFromSprintBacklogs(baseUrl) {
    try {
      const res = await erpFetch(`${baseUrl}/api/method/frappe.client.get_list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Sprint Backlogs",
          fields: ["sprint_assign"],
          filters: [["sprint_assign", "!=", ""]],
          order_by: "modified desc",
          limit_page_length: 30
        })
      }, 12000);
      if (!res.ok) {
        return {
          ok: false,
          error: `Could not resolve sprint from SPBs (${res.status}).`
        };
      }
      const json = await res.json();
      const rows = Array.isArray(json.message) ? json.message : [];
      const rnd = rows.find((r) => /r\s*&\s*d/i.test(String(r.sprint_assign || "")));
      const pick = (rnd?.sprint_assign || rows[0]?.sprint_assign || "").trim();
      if (!pick) {
        return { ok: false, error: "No Sprint found on Sprint Backlogs." };
      }
      return { ok: true, data: pick };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Failed to resolve sprint from SPBs.")
      };
    }
  }

  // lib/domain/usecases/concern/create_assignee_concern.usecase.ts
  async function createAssigneeConcern(input, baseUrl = ERP_BASE_URL) {
    const site = normalizeErpBaseUrl(baseUrl);
    if (!site)
      return { ok: false, error: "Invalid ERP URL." };
    const subject = input.subject.trim();
    if (!subject)
      return { ok: false, error: "Subject is required." };
    const session = await getExtensionSession(site);
    if (!session.ok)
      return session;
    const sprint = await getLatestSprintAssign(site);
    if (!sprint.ok)
      return sprint;
    const email = session.data.email;
    const type = (input.type || "Bugs/Issues").trim() || "Bugs/Issues";
    const priority = (input.priority || "Medium").trim() || "Medium";
    const description = input.description?.trim() || "<p>Created from Giya.</p>";
    const expStartDate = new Date().toISOString().slice(0, 10);
    try {
      const res = await erpFetch(`${site}/api/method/frappe.client.insert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: {
            doctype: "Sprint Backlogs",
            subject,
            type,
            status: "Open",
            priority,
            module: "RND",
            sprint_assign: sprint.data,
            sprint_points: "1",
            current_assignee: email,
            dev_assignee: email,
            qa_assignee: email,
            description,
            exp_start_date: expStartDate
          }
        })
      }, 20000);
      if (!res.ok) {
        let detail = "";
        try {
          const errJson = await res.json();
          detail = errJson.message || "";
        } catch {}
        return {
          ok: false,
          error: detail || `Could not create SPB (${res.status}).`
        };
      }
      const json = await res.json();
      const doc = json.message;
      if (!doc?.name) {
        return { ok: false, error: "SPB created but name was missing." };
      }
      return {
        ok: true,
        data: {
          name: String(doc.name),
          subject: String(doc.subject || subject),
          status: String(doc.status || "Open"),
          type: String(doc.type || type),
          priority: String(doc.priority || priority),
          sprintAssign: doc.sprint_assign || sprint.data,
          devAssignee: doc.dev_assignee || email,
          currentAssignee: doc.current_assignee || email
        }
      };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Failed to create SPB.")
      };
    }
  }

  // lib/domain/usecases/erpnext/fetch_erp_image_data_url.usecase.ts
  async function fetchErpImageDataUrl(url, timeoutMs = 8000) {
    if (!url || url.startsWith("data:"))
      return url || null;
    const controller = new AbortController;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal
      });
      if (!res.ok)
        return null;
      const blob = await res.blob();
      const type = blob.type || "image/png";
      if (!type.startsWith("image/"))
        return null;
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunk = 32768;
      for (let i = 0;i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return `data:${type};base64,${btoa(binary)}`;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // lib/domain/usecases/erpnext/get_erp_user_profile.usecase.ts
  var avatarCache = new Map;
  async function withAvatarDataUrl(profile) {
    if (!profile.userImage || profile.userImage.startsWith("data:"))
      return profile;
    const cached = avatarCache.get(profile.userImage);
    if (cached)
      return { ...profile, userImage: cached };
    const dataUrl = await fetchErpImageDataUrl(profile.userImage, 4000);
    if (dataUrl) {
      avatarCache.set(profile.userImage, dataUrl);
      return { ...profile, userImage: dataUrl };
    }
    return profile;
  }
  function absoluteErpUrl(site, path) {
    if (!path)
      return null;
    const trimmed = path.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined" || trimmed === "None") {
      return null;
    }
    if (/^https?:\/\//i.test(trimmed))
      return trimmed;
    if (trimmed.startsWith("//"))
      return `https:${trimmed}`;
    return `${site}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  }
  function profileFromCookies(site, userName, identity) {
    return {
      userName,
      email: userName.includes("@") ? userName : `${userName}@erp.local`,
      fullName: identity.fullName || userName,
      userImage: absoluteErpUrl(site, identity.userImage),
      userPath: `/app/user/${encodeURIComponent(userName)}`
    };
  }
  async function getErpUserProfile(baseUrl, sid) {
    const site = normalizeErpBaseUrl(baseUrl);
    if (!site)
      return { ok: false, error: "Invalid ERPNext base URL." };
    const identity = await readErpIdentityCookies(site);
    let userName = identity?.userId || "";
    if (!userName || userName === "Guest") {
      const logged = await getErpLoggedUser(site, sid);
      if (!logged.ok)
        return { ok: false, error: logged.error };
      userName = logged.data.email;
    }
    if (!userName || userName === "Guest") {
      return { ok: false, error: "Session expired." };
    }
    const cookieProfile = profileFromCookies(site, userName, {
      fullName: identity?.fullName ?? null,
      userImage: identity?.userImage ?? null
    });
    if (identity?.userId) {
      return { ok: true, data: await withAvatarDataUrl(cookieProfile) };
    }
    try {
      const userUrl = `${site}/api/resource/User/${encodeURIComponent(userName)}`;
      const res = await erpFetch(userUrl, {}, 4000);
      if (!res.ok) {
        return { ok: true, data: await withAvatarDataUrl(cookieProfile) };
      }
      const json = await res.json();
      const doc = json.data;
      if (!doc)
        return { ok: true, data: await withAvatarDataUrl(cookieProfile) };
      const email = (doc.email || doc.name || userName).trim();
      const fullName = (doc.full_name || [doc.first_name, doc.last_name].filter(Boolean).join(" ") || identity?.fullName || email).trim();
      return {
        ok: true,
        data: await withAvatarDataUrl({
          userName: (doc.name || userName).trim(),
          email,
          fullName,
          firstName: doc.first_name || undefined,
          lastName: doc.last_name || undefined,
          userImage: absoluteErpUrl(site, doc.user_image) || absoluteErpUrl(site, identity?.userImage),
          userPath: `/app/user/${encodeURIComponent(doc.name || userName)}`
        })
      };
    } catch {
      return { ok: true, data: await withAvatarDataUrl(cookieProfile) };
    }
  }

  // lib/domain/usecases/concern/giya_pin_markup.usecase.ts
  var MARKER = "data-giya-pin";
  function escapeAttr(value) {
    return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }
  function escapeHtml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }
  function buildEnvSpecsHtml(specs) {
    if (specs.length === 0)
      return "";
    const rows = specs.map((s) => `<li><strong>${escapeHtml(s.label)}:</strong> ${escapeHtml(s.value)}</li>`).join("");
    return `<details style="margin-top:8px">` + `<summary><small>System specs</small></summary>` + `<ul style="margin:6px 0 0;padding-left:18px;font-size:12px">${rows}</ul>` + `</details>`;
  }
  function buildGiyaPinCommentHtml(pin) {
    const payload = escapeAttr(JSON.stringify(pin));
    const specsHtml = pin.envSpecs?.length ? buildEnvSpecsHtml(pin.envSpecs) : "";
    return `<div ${MARKER}="1" data-giya-json="${payload}">` + `<p>${escapeHtml(pin.text)}</p>` + `<p><small>Giya pin · <a href="${escapeAttr(pin.href)}">${escapeHtml(pin.label)}</a></small></p>` + specsHtml + `</div>`;
  }
  function parseGiyaPinFromCommentHtml(content) {
    if (!content.includes(MARKER))
      return null;
    const match = content.match(/data-giya-json="([^"]+)"/);
    if (!match?.[1])
      return null;
    try {
      const decoded = match[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
      const parsed = JSON.parse(decoded);
      if (parsed?.v !== 1 || !parsed.href || !parsed.selector || !parsed.text)
        return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function hrefMatchesPin(pageHref, pinHref) {
    try {
      const a = new URL(pageHref);
      const b = new URL(pinHref);
      return a.origin === b.origin && a.pathname === b.pathname;
    } catch {
      return pageHref.split("#")[0] === pinHref.split("#")[0];
    }
  }

  // lib/domain/usecases/concern/add_concern_pin_comment.usecase.ts
  async function addConcernPinComment(concernName, pin, baseUrl = ERP_BASE_URL) {
    const site = normalizeErpBaseUrl(baseUrl);
    if (!site)
      return { ok: false, error: "Invalid ERP URL." };
    const name = concernName.trim();
    if (!name)
      return { ok: false, error: "Pick a concern (SPB) first." };
    if (!pin.text.trim())
      return { ok: false, error: "Write a comment first." };
    const session = await getExtensionSession(site);
    if (!session.ok)
      return session;
    const profile = await getErpUserProfile(site, session.data.sid);
    const commentBy = profile.ok ? profile.data.fullName : session.data.email;
    const commentEmail = profile.ok ? profile.data.email : session.data.email;
    try {
      const res = await erpFetch(`${site}/api/method/frappe.desk.form.utils.add_comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_doctype: "Sprint Backlogs",
          reference_name: name,
          content: buildGiyaPinCommentHtml({ ...pin, text: pin.text.trim() }),
          comment_email: commentEmail,
          comment_by: commentBy
        })
      });
      if (!res.ok) {
        return { ok: false, error: `Could not save comment (${res.status}).` };
      }
      const json = await res.json();
      const commentName = json.message?.name;
      if (!commentName)
        return { ok: false, error: "Comment saved but id missing." };
      return { ok: true, data: { commentName } };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Failed to save comment.")
      };
    }
  }

  // lib/domain/usecases/concern/list_assignee_concerns.usecase.ts
  async function listAssigneeConcerns(baseUrl = ERP_BASE_URL) {
    const site = normalizeErpBaseUrl(baseUrl);
    if (!site)
      return { ok: false, error: "Invalid ERP URL." };
    const session = await getExtensionSession(site);
    if (!session.ok)
      return session;
    const email = session.data.email;
    const sprint = await getLatestSprintAssign(site);
    if (!sprint.ok)
      return sprint;
    try {
      const url = `${site}/api/method/frappe.client.get_list`;
      const res = await erpFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Sprint Backlogs",
          fields: [
            "name",
            "subject",
            "status",
            "type",
            "priority",
            "sprint_assign",
            "dev_assignee",
            "current_assignee"
          ],
          filters: [
            ["current_assignee", "=", email],
            ["sprint_assign", "=", sprint.data],
            ["status", "not in", ["Completed", "Cancelled", "Closed"]]
          ],
          order_by: "modified desc",
          limit_page_length: 50
        })
      }, 15000);
      if (!res.ok) {
        return { ok: false, error: `Could not load concerns (${res.status}).` };
      }
      const json = await res.json();
      const rows = Array.isArray(json.message) ? json.message : [];
      return {
        ok: true,
        data: rows.filter((row) => row.name && row.subject).map((row) => ({
          name: String(row.name),
          subject: String(row.subject),
          status: String(row.status || ""),
          type: String(row.type || ""),
          priority: String(row.priority || ""),
          sprintAssign: row.sprint_assign || null,
          devAssignee: row.dev_assignee || null,
          currentAssignee: row.current_assignee || null
        }))
      };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Failed to list concerns.")
      };
    }
  }

  // lib/domain/usecases/concern/list_page_pin_comments.usecase.ts
  async function listPagePinComments(pageHref, baseUrl = ERP_BASE_URL, options = {}) {
    const site = normalizeErpBaseUrl(baseUrl);
    if (!site)
      return { ok: false, error: "Invalid ERP URL." };
    const session = await getExtensionSession(site);
    if (!session.ok)
      return session;
    let names = options.concernNames ?? [];
    let byName = options.concernSubjects ?? new Map;
    if (names.length === 0) {
      const concerns = await listAssigneeConcerns(site);
      if (!concerns.ok)
        return concerns;
      if (concerns.data.length === 0)
        return { ok: true, data: [] };
      names = concerns.data.map((c) => c.name);
      byName = new Map(concerns.data.map((c) => [c.name, c.subject]));
    }
    if (names.length === 0)
      return { ok: true, data: [] };
    try {
      const res = await erpFetch(`${site}/api/method/frappe.client.get_list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Comment",
          fields: [
            "name",
            "content",
            "comment_by",
            "comment_email",
            "reference_name",
            "creation"
          ],
          filters: [
            ["reference_doctype", "=", "Sprint Backlogs"],
            ["comment_type", "=", "Comment"],
            ["reference_name", "in", names],
            ["content", "like", "%data-giya-pin%"]
          ],
          order_by: "creation desc",
          limit_page_length: 100
        })
      }, 15000);
      if (!res.ok) {
        return { ok: false, error: `Could not load comments (${res.status}).` };
      }
      const json = await res.json();
      const rows = Array.isArray(json.message) ? json.message : [];
      const pins = [];
      for (const row of rows) {
        const pin = parseGiyaPinFromCommentHtml(String(row.content || ""));
        if (!pin || !hrefMatchesPin(pageHref, pin.href))
          continue;
        const concernName = String(row.reference_name || "");
        const concernSubject = byName.get(concernName);
        if (!concernSubject)
          continue;
        pins.push({
          commentName: String(row.name || ""),
          concernName,
          concernSubject,
          commentBy: String(row.comment_by || row.comment_email || "Someone"),
          commentEmail: String(row.comment_email || ""),
          creation: String(row.creation || ""),
          pin
        });
      }
      return { ok: true, data: pins };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Failed to load page pins.")
      };
    }
  }

  // lib/domain/services/concern.service.ts
  var CONCERNS_TTL_MS = 60000;
  var PINS_TTL_MS = 30000;
  var concernsCache = null;
  var concernsCacheEmail = null;
  var pinsCache = new Map;
  function pageKey(email, href) {
    try {
      const url = new URL(href);
      return `${email}|${url.origin}${url.pathname}`;
    } catch {
      return `${email}|${href.split("#")[0]}`;
    }
  }
  function invalidateConcernCaches() {
    concernsCache = null;
    concernsCacheEmail = null;
    pinsCache.clear();
  }
  async function listAssigneeConcerns2(baseUrl = ERP_BASE_URL, options = {}) {
    const session = await getExtensionSession(baseUrl);
    if (!session.ok)
      return session;
    const email = session.data.email;
    if (!options.force && concernsCache && concernsCacheEmail === email && Date.now() - concernsCache.at < CONCERNS_TTL_MS) {
      return { ok: true, data: concernsCache.data };
    }
    const result = await listAssigneeConcerns(baseUrl);
    if (result.ok) {
      concernsCache = { at: Date.now(), data: result.data };
      concernsCacheEmail = email;
    }
    return result;
  }
  async function createAssigneeConcern2(input, baseUrl = ERP_BASE_URL) {
    const result = await createAssigneeConcern(input, baseUrl);
    if (result.ok)
      invalidateConcernCaches();
    return result;
  }
  async function addConcernPinComment2(concernName, pin, baseUrl = ERP_BASE_URL) {
    const result = await addConcernPinComment(concernName, pin, baseUrl);
    if (result.ok)
      invalidateConcernCaches();
    return result;
  }
  async function listPagePinComments2(pageHref, baseUrl = ERP_BASE_URL, options = {}) {
    const session = await getExtensionSession(baseUrl);
    if (!session.ok)
      return session;
    const key = pageKey(session.data.email, pageHref);
    const hit = pinsCache.get(key);
    if (!options.force && hit && Date.now() - hit.at < PINS_TTL_MS) {
      return { ok: true, data: hit.data };
    }
    const concerns = await listAssigneeConcerns2(baseUrl);
    if (!concerns.ok)
      return concerns;
    const result = await listPagePinComments(pageHref, baseUrl, {
      concernNames: concerns.data.map((c) => c.name),
      concernSubjects: new Map(concerns.data.map((c) => [c.name, c.subject]))
    });
    if (result.ok) {
      pinsCache.set(key, { at: Date.now(), data: result.data });
    }
    return result;
  }

  // lib/domain/services/auth.service.ts
  async function getSession(baseUrl = ERP_BASE_URL, options = {}) {
    return getExtensionSession(baseUrl, options);
  }
  async function peekSid(_baseUrl = ERP_BASE_URL) {
    const connection = await getGiyaConnection();
    return Boolean(connection?.sid);
  }
  async function peekConnection() {
    return getGiyaConnection();
  }
  async function connectErp(input) {
    const result = await connectLivroErp(input);
    if (result.ok && !(("needsOtp" in result.data) && result.data.needsOtp)) {
      invalidateConcernCaches();
    }
    return result;
  }
  async function connectErpFromDesk(baseUrl = ERP_BASE_URL) {
    const result = await connectWithDeskSid(baseUrl);
    if (result.ok)
      invalidateConcernCaches();
    return result;
  }
  async function disconnectErp() {
    await disconnectLivroErp();
    invalidateConcernCaches();
  }
  function openLivroLogin(baseUrl = ERP_BASE_URL) {
    chrome.tabs.create({ url: erpLoginUrl(baseUrl) });
  }
  function openExtensionLoginPage() {
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/login.html") });
  }
  function invalidateSessionCache() {
    clearSessionCache();
  }

  // lib/domain/usecases/user/get_user_profile.usecase.ts
  async function getUserProfile(baseUrl = ERP_BASE_URL) {
    const session = await getExtensionSession(baseUrl);
    if (!session.ok)
      return session;
    return getErpUserProfile(session.data.baseUrl, session.data.sid);
  }

  // lib/domain/services/user.service.ts
  async function getUserProfile2(baseUrl = ERP_BASE_URL) {
    return getUserProfile(baseUrl);
  }
  function openUserPage() {
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/user.html") });
  }

  // src/shared/defaults.ts
  var DEFAULT_POSITION = "bottom-right";
  var DEFAULT_SIDEBAR_WIDTH = 360;
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

  // src/background/service-worker.ts
  chrome.runtime.onInstalled.addListener(() => {
    (async () => {
      const current = await chrome.storage.sync.get(Object.keys(STORAGE_DEFAULTS));
      const toSet = {};
      for (const [key, value] of Object.entries(STORAGE_DEFAULTS)) {
        const typedKey = key;
        if (current[typedKey] === undefined) {
          toSet[typedKey] = value;
        }
      }
      if (Object.keys(toSet).length > 0) {
        await chrome.storage.sync.set(toSet);
      }
    })();
  });
  async function handleMessage(message) {
    if (message.type === "PEEK_SID") {
      const hasSid = await peekSid(ERP_BASE_URL);
      return { type: "PEEK_SID", hasSid };
    }
    if (message.type === "GET_CONNECTION") {
      const connection = await peekConnection();
      return { type: "CONNECTION", ok: true, connection };
    }
    if (message.type === "CONNECT_ERP") {
      const input = message.tmpId && message.otp ? { tmp_id: message.tmpId, otp: message.otp, usr: message.usr } : { usr: message.usr || "", pwd: message.pwd || "" };
      const result = await connectErp(input);
      if (!result.ok) {
        return { type: "CONNECT_ERP", ok: false, error: result.error };
      }
      if ("needsOtp" in result.data && result.data.needsOtp) {
        return {
          type: "CONNECT_ERP",
          ok: true,
          needsOtp: true,
          tmpId: result.data.tmpId,
          prompt: result.data.prompt,
          method: result.data.method
        };
      }
      return {
        type: "CONNECT_ERP",
        ok: true,
        connection: result.data.connection
      };
    }
    if (message.type === "CONNECT_ERP_DESK") {
      const result = await connectErpFromDesk(ERP_BASE_URL);
      if (!result.ok) {
        return { type: "CONNECT_ERP", ok: false, error: result.error };
      }
      return { type: "CONNECT_ERP", ok: true, connection: result.data };
    }
    if (message.type === "DISCONNECT_ERP") {
      await disconnectErp();
      return { type: "DISCONNECTED" };
    }
    if (message.type === "GET_SESSION") {
      const result = await getSession(ERP_BASE_URL, { force: Boolean(message.force) });
      return result.ok ? { type: "SESSION", ok: true, session: result.data } : { type: "SESSION", ok: false, error: result.error };
    }
    if (message.type === "GET_USER_PROFILE") {
      const result = await getUserProfile2(ERP_BASE_URL);
      return result.ok ? { type: "USER_PROFILE", ok: true, profile: result.data } : { type: "USER_PROFILE", ok: false, error: result.error };
    }
    if (message.type === "LIST_CONCERNS") {
      const result = await listAssigneeConcerns2(ERP_BASE_URL);
      return result.ok ? { type: "CONCERNS", ok: true, concerns: result.data } : { type: "CONCERNS", ok: false, error: result.error };
    }
    if (message.type === "CREATE_CONCERN") {
      const result = await createAssigneeConcern2({
        subject: message.subject,
        type: message.concernType,
        priority: message.priority,
        description: message.description
      }, ERP_BASE_URL);
      return result.ok ? { type: "CONCERN_CREATED", ok: true, concern: result.data } : { type: "CONCERN_CREATED", ok: false, error: result.error };
    }
    if (message.type === "LIST_PAGE_PINS") {
      const result = await listPagePinComments2(message.href, ERP_BASE_URL);
      return result.ok ? { type: "PAGE_PINS", ok: true, pins: result.data } : { type: "PAGE_PINS", ok: false, error: result.error };
    }
    if (message.type === "ADD_CONCERN_PIN") {
      const result = await addConcernPinComment2(message.concernName, message.pin, ERP_BASE_URL);
      return result.ok ? { type: "PIN_SAVED", ok: true, commentName: result.data.commentName } : { type: "PIN_SAVED", ok: false, error: result.error };
    }
    if (message.type === "OPEN_LOGIN_PAGE") {
      openExtensionLoginPage();
      return { type: "OPENED_LOGIN" };
    }
    if (message.type === "OPEN_USER_PAGE") {
      const result = await getSession(ERP_BASE_URL);
      if (!result.ok) {
        openExtensionLoginPage();
        return { type: "OPENED_LOGIN" };
      }
      openUserPage();
      return { type: "OPENED_USER" };
    }
    if (message.type === "OPEN_LIVRO_LOGIN") {
      openLivroLogin(ERP_BASE_URL);
      return { type: "OPENED_LOGIN" };
    }
    return { type: "SESSION", ok: false, error: "Unknown message." };
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then((response) => {
      try {
        sendResponse(response);
      } catch {}
    }).catch((error) => {
      const text = error instanceof Error ? error.message : "Background handler failed.";
      try {
        sendResponse({ type: "SESSION", ok: false, error: text });
      } catch {}
    });
    return true;
  });
  chrome.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.cookie.name !== "sid")
      return;
    if (!changeInfo.cookie.domain.includes("livro.systems"))
      return;
    invalidateSessionCache();
    invalidateConcernCaches();
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id == null)
          continue;
        chrome.tabs.sendMessage(tab.id, { type: "AUTH_CHANGED" }).catch(() => {});
      }
    });
  });
  chrome.action.onClicked.addListener(() => {
    (async () => {
      const result = await getSession(ERP_BASE_URL);
      if (!result.ok) {
        openExtensionLoginPage();
        return;
      }
      openUserPage();
    })();
  });
})();

//# debugId=507E995A6758A04A64756E2164756E21
//# sourceMappingURL=service-worker.js.map
