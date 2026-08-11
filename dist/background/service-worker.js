(() => {
  // lib/entities/erpnext.type.ts
  var ERP_HOST = "erp.livro.systems";
  var ERP_BASE_URL = `https://${ERP_HOST}`;
  function normalizeErpBaseUrl(raw) {
    const value = (raw || ERP_BASE_URL).trim();
    if (!value)
      return null;
    try {
      const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const url = new URL(withProtocol);
      const host = url.hostname.toLowerCase();
      if (host !== ERP_HOST && host !== `www.${ERP_HOST}`) {
        return null;
      }
      return ERP_BASE_URL;
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
  async function readCookie(url, name) {
    try {
      const cookie = await chrome.cookies.get({ url, name });
      return cookie?.value?.trim() ?? "";
    } catch {
      return "";
    }
  }
  async function ensureErpSidCookie(baseUrl, sid, identity = {}) {
    const site = normalizeErpBaseUrl(baseUrl);
    const value = sid.trim();
    if (!site || !value || value === "Guest")
      return false;
    const currentSid = await readCookie(site, "sid");
    let wrote = false;
    if (currentSid !== value) {
      let ok = await setCookie(site, "sid", value, true);
      if (!ok)
        ok = await setCookie(site, "sid", value, false);
      wrote = ok;
    }
    const wantUser = identity.userId?.trim() || "";
    if (wantUser) {
      const currentUser = await readCookie(site, "user_id");
      if (currentUser !== wantUser) {
        await setCookie(site, "user_id", wantUser, false);
        wrote = true;
      }
    }
    const wantName = identity.fullName?.trim() || "";
    if (wantName) {
      const currentName = await readCookie(site, "full_name");
      if (currentName !== wantName) {
        await setCookie(site, "full_name", wantName, false);
        wrote = true;
      }
    }
    if (currentSid === value || wrote) {
      const stored = await readCookie(site, "sid");
      return Boolean(stored && stored !== "Guest");
    }
    return false;
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
      const [sidCookie, userIdCookie, fullNameCookie, userImageCookie, csrfCookie] = await Promise.all([
        chrome.cookies.get({ url: site, name: "sid" }),
        chrome.cookies.get({ url: site, name: "user_id" }),
        chrome.cookies.get({ url: site, name: "full_name" }),
        chrome.cookies.get({ url: site, name: "user_image" }),
        chrome.cookies.get({ url: site, name: "csrf_token" })
      ]);
      const sid = sidCookie?.value?.trim() ?? "";
      if (!sid || sid === "Guest")
        return null;
      return {
        sid,
        userId: decodeCookieValue(userIdCookie?.value),
        fullName: decodeCookieValue(fullNameCookie?.value),
        userImage: decodeCookieValue(userImageCookie?.value),
        csrfToken: decodeCookieValue(csrfCookie?.value)
      };
    } catch {
      return null;
    }
  }

  // lib/domain/usecases/auth/get_extension_session.usecase.ts
  var CACHE_TTL_MS = 60000;
  var memoryCache = null;
  var inflight = null;
  async function getExtensionSession(baseUrl = ERP_BASE_URL, options = {}) {
    const site = normalizeErpBaseUrl(baseUrl);
    if (!site)
      return { ok: false, error: "ERP URL is not configured." };
    if (!options.force && memoryCache && Date.now() - memoryCache.at < CACHE_TTL_MS) {
      return memoryCache.result;
    }
    if (inflight)
      return inflight;
    inflight = resolveSession(site).finally(() => {
      inflight = null;
    });
    return inflight;
  }
  async function resolveSession(site) {
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
      const origin = ERP_BASE_URL;
      let identity = await readErpIdentityCookies(origin);
      const cookieMatches = Boolean(identity?.sid && connection.sid) && identity.sid === connection.sid;
      if (!cookieMatches) {
        await ensureErpSidCookie(origin, connection.sid, {
          userId: connection.email,
          fullName: connection.fullName
        });
        identity = await readErpIdentityCookies(origin);
      }
      const sid = identity?.sid || "";
      if (!sid || sid === "Guest") {
        const result2 = {
          ok: false,
          error: "Login required."
        };
        memoryCache = { at: Date.now(), result: result2 };
        return result2;
      }
      const email = (identity?.userId && identity.userId !== "Guest" ? identity.userId : connection.email) || "";
      if (!email || email === "Guest") {
        const result2 = {
          ok: false,
          error: "Connect Livro in Giya first."
        };
        memoryCache = { at: Date.now(), result: result2 };
        return result2;
      }
      const result = {
        ok: true,
        data: {
          email,
          sid: connection.sid,
          baseUrl: origin
        }
      };
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
    inflight = null;
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
    const connection = await saveConnection(success.email, success.fullName, success.baseUrl, success.sid);
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
    const email = identity.userId || "";
    if (!email || email === "Guest") {
      return {
        ok: false,
        error: "Livro cookies incomplete (need sid + user_id). Open Desk and retry."
      };
    }
    const connection = await saveConnection(email, identity.fullName || email, site, identity.sid);
    return { ok: true, data: connection };
  }
  async function disconnectLivroErp() {
    await clearGiyaConnection();
  }

  // lib/domain/usecases/erpnext/erp_fetch.usecase.ts
  function headersToRecord(headers) {
    if (!headers)
      return {};
    if (headers instanceof Headers) {
      const out = {};
      headers.forEach((value, key) => {
        out[key] = value;
      });
      return out;
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    return { ...headers };
  }
  async function readCsrfToken(site) {
    try {
      const cookie = await chrome.cookies.get({ url: site, name: "csrf_token" });
      const raw = cookie?.value?.trim();
      if (!raw)
        return null;
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    } catch {
      return null;
    }
  }
  async function erpFetch(url, init = {}, timeoutMs = 15000) {
    const site = normalizeErpBaseUrl(url) || ERP_BASE_URL;
    const method = (init.method || "GET").toUpperCase();
    const needsCsrf = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    const csrf = needsCsrf ? await readCsrfToken(site) : null;
    const controller = new AbortController;
    const timer = setTimeout(() => controller.abort("ERP_TIMEOUT"), timeoutMs);
    try {
      const headers = headersToRecord(init.headers);
      headers.Accept = headers.Accept || "application/json";
      if (csrf) {
        headers["X-Frappe-CSRF-Token"] = csrf;
      }
      if (init.body instanceof FormData) {
        delete headers["Content-Type"];
        delete headers["content-type"];
      }
      return await fetch(url, {
        ...init,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers
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

  // lib/domain/usecases/concern/get_latest_sprint_assign.usecase.ts
  async function getLatestSprintAssign(baseUrl) {
    const fromSpb = await tryFromSprintBacklogs(baseUrl);
    if (fromSpb.ok)
      return fromSpb;
    return {
      ok: false,
      error: fromSpb.error || "Could not resolve sprint from Sprint Backlogs. Reconnect Livro and retry."
    };
  }
  async function recoverSidCookie(baseUrl) {
    clearSessionCache();
    const connection = await getGiyaConnection();
    if (!connection?.sid)
      return;
    await ensureErpSidCookie(baseUrl, connection.sid, {
      userId: connection.email,
      fullName: connection.fullName
    });
  }
  async function tryFromSprintBacklogs(baseUrl) {
    const attempts = [
      [["sprint_assign", "is", "set"]],
      [["sprint_assign", "!=", ""]],
      []
    ];
    let lastError = "Could not read Sprint Backlogs for sprint.";
    let recovered = false;
    for (const filters of attempts) {
      let result = await fetchSpbSprintAssigns(baseUrl, filters);
      if (!result.ok && !recovered && result.error.toLowerCase().includes("failed to fetch")) {
        await recoverSidCookie(baseUrl);
        recovered = true;
        result = await fetchSpbSprintAssigns(baseUrl, filters);
      }
      if (result.ok) {
        const pick = pickLatestRndSprint(result.data);
        if (pick)
          return { ok: true, data: pick };
        lastError = "No sprint_assign values on Sprint Backlogs.";
        continue;
      }
      lastError = result.error;
      if (result.error.toLowerCase().includes("failed to fetch"))
        break;
    }
    return { ok: false, error: lastError };
  }
  async function fetchSpbSprintAssigns(baseUrl, filters) {
    try {
      const params = new URLSearchParams({
        doctype: "Sprint Backlogs",
        fields: JSON.stringify(["sprint_assign", "modified"]),
        order_by: "modified desc",
        limit_page_length: "50"
      });
      if (filters.length)
        params.set("filters", JSON.stringify(filters));
      const res = await erpFetch(`${baseUrl}/api/method/frappe.client.get_list?${params}`, { method: "GET" }, 15000);
      if (!res.ok) {
        return { ok: false, error: await erpHttpError(res, "Sprint Backlogs") };
      }
      const json = await res.json();
      if (json.exc) {
        return {
          ok: false,
          error: "Could not list Sprint Backlogs (permission or session)."
        };
      }
      const rows = Array.isArray(json.message) ? json.message : [];
      const values = rows.map((r) => String(r.sprint_assign || "").trim()).filter(Boolean);
      return { ok: true, data: values };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Sprint Backlogs lookup failed.")
      };
    }
  }
  function pickLatestRndSprint(values) {
    if (!values.length)
      return null;
    const rnd = values.filter((v) => /r\s*&\s*d/i.test(v));
    const pool = rnd.length ? rnd : values;
    let best = null;
    let bestNum = -1;
    for (const label of pool) {
      const m = label.match(/(\d+)/);
      const n = m ? Number(m[1]) : -1;
      if (n > bestNum) {
        bestNum = n;
        best = label;
      }
    }
    return best || pool[0] || null;
  }
  async function erpHttpError(res, label) {
    let detail = "";
    try {
      const json = await res.json();
      if (typeof json.message === "string")
        detail = json.message;
      else if (json.message && typeof json.message === "object") {
        detail = String(json.message.message || "");
      }
      if (!detail && json._server_messages) {
        try {
          const arr = JSON.parse(json._server_messages);
          const first = arr[0] ? JSON.parse(arr[0]) : null;
          detail = first?.message || "";
        } catch {}
      }
    } catch {}
    return detail || `Could not load ${label} (${res.status}).`;
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
    const connection = await getGiyaConnection();
    let userName = identity?.userId || connection?.email || "";
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
        kept.push('style="max-width:100%;height:auto"');
      } else {
        return "";
      }
      const alt = attrs.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i);
      if (alt)
        kept.push(`alt="${(alt[2] || alt[3] || "").replaceAll('"', "")}"`);
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
    const bodyHtml = sanitizeCommentHtml(pin.text);
    const plain = commentHtmlToPlainText(bodyHtml) || pin.label;
    const payload = escapeAttr(JSON.stringify({
      ...pin,
      text: bodyHtml
    }));
    const specsHtml = pin.envSpecs?.length ? buildEnvSpecsHtml(pin.envSpecs) : "";
    return `<div ${MARKER}="1" data-giya-json="${payload}">` + `<div class="giya-comment-body">${bodyHtml}</div>` + `<p><small>Giya pin · <a href="${escapeAttr(pin.href)}">${escapeHtml(pin.label)}</a>` + (plain ? ` · ${escapeHtml(plain.slice(0, 80))}` : "") + `</small></p>` + specsHtml + `</div>`;
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
      return {
        ...parsed,
        text: sanitizeCommentHtml(parsed.text)
      };
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
    const html = sanitizeCommentHtml(pin.text);
    if (isBlankCommentHtml(html)) {
      return { ok: false, error: "Write a comment first." };
    }
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
          content: buildGiyaPinCommentHtml({ ...pin, text: html }),
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

  // lib/domain/usecases/concern/get_concern_devops_status.usecase.ts
  function isDevopsResolved(status) {
    return Boolean(String(status || "").trim());
  }
  async function getConcernDevopsStatus(concernName, baseUrl = ERP_BASE_URL) {
    const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
    const session = await getExtensionSession(site);
    if (!session.ok)
      return session;
    const name = concernName.trim();
    if (!name)
      return { ok: false, error: "Missing concern." };
    try {
      const params = new URLSearchParams({
        doctype: "Sprint Backlogs",
        fields: JSON.stringify(["name", "devops_status"]),
        filters: JSON.stringify([["name", "=", name]]),
        limit_page_length: "1"
      });
      const res = await erpFetch(`${site}/api/method/frappe.client.get_list?${params}`, { method: "GET" }, 12000);
      if (!res.ok) {
        return { ok: false, error: `Could not read status (${res.status}).` };
      }
      const json = await res.json();
      if (json.exc) {
        return { ok: false, error: "Could not read DevOps status." };
      }
      const row = Array.isArray(json.message) ? json.message[0] : undefined;
      const devopsStatus = String(row?.devops_status || "").trim();
      return {
        ok: true,
        data: {
          devopsStatus,
          resolved: isDevopsResolved(devopsStatus)
        }
      };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Failed to read DevOps status.")
      };
    }
  }
  async function resolveConcernForStaging(concernName, baseUrl = ERP_BASE_URL) {
    const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
    const session = await getExtensionSession(site);
    if (!session.ok)
      return session;
    const name = concernName.trim();
    if (!name)
      return { ok: false, error: "Missing concern." };
    const current = await getConcernDevopsStatus(name, site);
    if (!current.ok)
      return current;
    if (current.data.resolved)
      return { ok: true, data: current.data };
    try {
      const res = await erpFetch(`${site}/api/method/frappe.client.set_value`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Sprint Backlogs",
          name,
          fieldname: "devops_status",
          value: "For Staging Update"
        })
      });
      if (!res.ok) {
        return { ok: false, error: `Could not resolve (${res.status}).` };
      }
      const json = await res.json();
      if (json.exc) {
        return { ok: false, error: "Could not update DevOps status." };
      }
      return {
        ok: true,
        data: {
          devopsStatus: "For Staging Update",
          resolved: true
        }
      };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Failed to mark resolved.")
      };
    }
  }

  // lib/domain/usecases/concern/list_assignee_concerns.usecase.ts
  var DONE_STATUSES = new Set(["completed", "cancelled", "closed"]);
  async function listAssigneeConcerns(_baseUrl = ERP_BASE_URL) {
    const site = ERP_BASE_URL;
    const session = await getExtensionSession(site);
    if (!session.ok)
      return session;
    let email = session.data.email.trim();
    try {
      email = decodeURIComponent(email);
    } catch {}
    const params = new URLSearchParams({
      doctype: "Sprint Backlogs",
      fields: JSON.stringify([
        "name",
        "subject",
        "status",
        "type",
        "priority",
        "sprint_assign",
        "dev_assignee",
        "current_assignee"
      ]),
      filters: JSON.stringify([["current_assignee", "=", email]]),
      order_by: "modified desc",
      limit_page_length: "50"
    });
    try {
      const res = await erpFetch(`${site}/api/method/frappe.client.get_list?${params}`, { method: "GET" }, 15000);
      if (!res.ok) {
        const detail = await readErpError(res);
        return {
          ok: false,
          error: detail || `Could not load concerns (${res.status}).`
        };
      }
      const json = await res.json();
      if (json.exc) {
        return {
          ok: false,
          error: "Could not list Sprint Backlogs (permission or session)."
        };
      }
      const rows = Array.isArray(json.message) ? json.message : [];
      return {
        ok: true,
        data: rows.filter((row) => row.name && row.subject).filter((row) => !DONE_STATUSES.has(String(row.status || "").toLowerCase())).map((row) => ({
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
  async function readErpError(res) {
    try {
      const json = await res.json();
      if (typeof json.message === "string" && json.message.trim()) {
        return json.message.trim().slice(0, 180);
      }
      if (json.message && typeof json.message === "object" && json.message.message) {
        return String(json.message.message).trim().slice(0, 180);
      }
      if (json._server_messages) {
        try {
          const arr = JSON.parse(json._server_messages);
          const first = arr[0] ? JSON.parse(arr[0]) : null;
          if (first?.message)
            return String(first.message).trim().slice(0, 180);
        } catch {}
      }
    } catch {}
    return "";
  }

  // lib/domain/usecases/concern/list_pin_thread.usecase.ts
  function pinThreadId(commentName, pin) {
    return String(pin.threadId || "").trim() || commentName;
  }
  function isPinReply(pin) {
    return Boolean(String(pin.parentId || "").trim());
  }
  async function listPinThreadComments(concernName, threadId, baseUrl = ERP_BASE_URL) {
    const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
    const session = await getExtensionSession(site);
    if (!session.ok)
      return session;
    const name = concernName.trim();
    const tid = threadId.trim();
    if (!name || !tid)
      return { ok: false, error: "Missing thread." };
    try {
      const params = new URLSearchParams({
        doctype: "Comment",
        fields: JSON.stringify([
          "name",
          "content",
          "comment_by",
          "comment_email",
          "reference_name",
          "creation"
        ]),
        filters: JSON.stringify([
          ["reference_doctype", "=", "Sprint Backlogs"],
          ["comment_type", "=", "Comment"],
          ["reference_name", "=", name],
          ["content", "like", "%data-giya-pin%"]
        ]),
        order_by: "creation asc",
        limit_page_length: "100"
      });
      const res = await erpFetch(`${site}/api/method/frappe.client.get_list?${params}`, { method: "GET" }, 15000);
      if (!res.ok) {
        return { ok: false, error: `Could not load thread (${res.status}).` };
      }
      const json = await res.json();
      const rows = Array.isArray(json.message) ? json.message : [];
      const parsed = [];
      for (const row of rows) {
        const pin = parseGiyaPinFromCommentHtml(String(row.content || ""));
        if (!pin)
          continue;
        const commentName = String(row.name || "");
        if (!commentName)
          continue;
        parsed.push({
          commentName,
          concernName: name,
          concernSubject: "",
          commentBy: String(row.comment_by || row.comment_email || "Someone"),
          commentEmail: String(row.comment_email || ""),
          creation: String(row.creation || ""),
          pin: { ...pin, threadId: pinThreadId(commentName, pin) }
        });
      }
      const byName = new Map(parsed.map((p) => [p.commentName, p]));
      const inThread = new Set;
      for (const item of parsed) {
        if (item.pin.threadId === tid || item.commentName === tid) {
          inThread.add(item.commentName);
        }
      }
      let grew = true;
      while (grew) {
        grew = false;
        for (const item of parsed) {
          if (inThread.has(item.commentName))
            continue;
          const parent = String(item.pin.parentId || "");
          if (parent && inThread.has(parent)) {
            inThread.add(item.commentName);
            grew = true;
          }
        }
      }
      const thread = parsed.filter((p) => inThread.has(p.commentName)).map((p) => ({
        ...p,
        pin: { ...p.pin, threadId: tid }
      }));
      if (thread.length === 0 && byName.has(tid)) {
        const root = byName.get(tid);
        return { ok: true, data: [{ ...root, pin: { ...root.pin, threadId: tid } }] };
      }
      return { ok: true, data: thread };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Failed to load discussion.")
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
      const params = new URLSearchParams({
        doctype: "Comment",
        fields: JSON.stringify([
          "name",
          "content",
          "comment_by",
          "comment_email",
          "reference_name",
          "creation"
        ]),
        filters: JSON.stringify([
          ["reference_doctype", "=", "Sprint Backlogs"],
          ["comment_type", "=", "Comment"],
          ["reference_name", "in", names],
          ["content", "like", "%data-giya-pin%"]
        ]),
        order_by: "creation desc",
        limit_page_length: "100"
      });
      const res = await erpFetch(`${site}/api/method/frappe.client.get_list?${params}`, { method: "GET" }, 15000);
      if (!res.ok) {
        return { ok: false, error: `Could not load comments (${res.status}).` };
      }
      const json = await res.json();
      const rows = Array.isArray(json.message) ? json.message : [];
      const pins = [];
      const seenThreads = new Set;
      for (const row of rows) {
        const pin = parseGiyaPinFromCommentHtml(String(row.content || ""));
        if (!pin || !hrefMatchesPin(pageHref, pin.href))
          continue;
        if (isPinReply(pin))
          continue;
        const commentName = String(row.name || "");
        const thread = pinThreadId(commentName, pin);
        if (seenThreads.has(thread))
          continue;
        seenThreads.add(thread);
        const concernName = String(row.reference_name || "");
        const concernSubject = byName.get(concernName);
        if (!concernSubject)
          continue;
        pins.push({
          commentName,
          concernName,
          concernSubject,
          commentBy: String(row.comment_by || row.comment_email || "Someone"),
          commentEmail: String(row.comment_email || ""),
          creation: String(row.creation || ""),
          pin: { ...pin, threadId: thread }
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

  // lib/domain/usecases/erpnext/upload_erp_file.usecase.ts
  function decodeBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0;i < binary.length; i++)
      bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  async function uploadErpFile(input, baseUrl = ERP_BASE_URL) {
    const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
    const session = await getExtensionSession(site);
    if (!session.ok)
      return session;
    const filename = input.filename.trim() || "upload.bin";
    if (!input.base64)
      return { ok: false, error: "No file data." };
    try {
      const bytes = decodeBase64(input.base64);
      const blob = new Blob([bytes.buffer], {
        type: input.mimeType || "application/octet-stream"
      });
      const form = new FormData;
      form.append("file", blob, filename);
      form.append("is_private", input.isPrivate === false ? "0" : "1");
      form.append("folder", "Home/Attachments");
      if (input.doctype)
        form.append("doctype", input.doctype);
      if (input.docname)
        form.append("docname", input.docname);
      const res = await erpFetch(`${site}/api/method/upload_file`, { method: "POST", body: form }, 60000);
      if (!res.ok) {
        return { ok: false, error: `Upload failed (${res.status}).` };
      }
      const json = await res.json();
      if (json.exc) {
        return { ok: false, error: "Upload rejected by Livro." };
      }
      const fileUrl = json.message?.file_url?.trim() || "";
      if (!fileUrl)
        return { ok: false, error: "Upload succeeded but no file URL." };
      const absolute = fileUrl.startsWith("http") ? fileUrl : `${site}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
      return {
        ok: true,
        data: {
          fileUrl: absolute,
          fileName: json.message?.file_name || filename
        }
      };
    } catch (error) {
      return {
        ok: false,
        error: erpErrorMessage(error, "Failed to upload file.")
      };
    }
  }

  // lib/domain/services/concern.service.ts
  var CONCERNS_TTL_MS = 60000;
  var PINS_TTL_MS = 30000;
  var concernsCache = null;
  var concernsCacheEmail = null;
  var concernsInflight = null;
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
    if (!options.force && concernsInflight)
      return concernsInflight;
    const run = (async () => {
      const result = await listAssigneeConcerns(baseUrl);
      if (result.ok) {
        concernsCache = { at: Date.now(), data: result.data };
        concernsCacheEmail = email;
      }
      return result;
    })();
    if (!options.force) {
      concernsInflight = run.finally(() => {
        concernsInflight = null;
      });
      return concernsInflight;
    }
    return run;
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
  async function listPinThreadComments2(concernName, threadId, baseUrl = ERP_BASE_URL) {
    return listPinThreadComments(concernName, threadId, baseUrl);
  }
  async function getConcernDevopsStatus2(concernName, baseUrl = ERP_BASE_URL) {
    return getConcernDevopsStatus(concernName, baseUrl);
  }
  async function resolveConcernForStaging2(concernName, baseUrl = ERP_BASE_URL) {
    const result = await resolveConcernForStaging(concernName, baseUrl);
    if (result.ok)
      invalidateConcernCaches();
    return result;
  }
  async function uploadErpFile2(input, baseUrl = ERP_BASE_URL) {
    return uploadErpFile(input, baseUrl);
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
  var DEFAULT_PANEL_WIDTH = 380;
  var DEFAULT_PANEL_HEIGHT = 440;
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
      const result = await listAssigneeConcerns2(ERP_BASE_URL, {
        force: Boolean(message.force)
      });
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
    if (message.type === "LIST_PIN_THREAD") {
      const result = await listPinThreadComments2(message.concernName, message.threadId, ERP_BASE_URL);
      return result.ok ? { type: "PIN_THREAD", ok: true, comments: result.data } : { type: "PIN_THREAD", ok: false, error: result.error };
    }
    if (message.type === "GET_CONCERN_DEVOPS") {
      const result = await getConcernDevopsStatus2(message.concernName, ERP_BASE_URL);
      return result.ok ? {
        type: "CONCERN_DEVOPS",
        ok: true,
        devopsStatus: result.data.devopsStatus,
        resolved: result.data.resolved
      } : { type: "CONCERN_DEVOPS", ok: false, error: result.error };
    }
    if (message.type === "RESOLVE_CONCERN") {
      const result = await resolveConcernForStaging2(message.concernName, ERP_BASE_URL);
      return result.ok ? {
        type: "CONCERN_DEVOPS",
        ok: true,
        devopsStatus: result.data.devopsStatus,
        resolved: result.data.resolved
      } : { type: "CONCERN_DEVOPS", ok: false, error: result.error };
    }
    if (message.type === "UPLOAD_ERP_FILE") {
      const result = await uploadErpFile2({
        filename: message.filename,
        mimeType: message.mimeType,
        base64: message.base64,
        doctype: message.doctype,
        docname: message.docname,
        isPrivate: message.isPrivate
      }, ERP_BASE_URL);
      return result.ok ? {
        type: "ERP_FILE",
        ok: true,
        fileUrl: result.data.fileUrl,
        fileName: result.data.fileName
      } : { type: "ERP_FILE", ok: false, error: result.error };
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
    if (!changeInfo.removed)
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

//# debugId=C57F116AB5094EBC64756E2164756E21
//# sourceMappingURL=service-worker.js.map
