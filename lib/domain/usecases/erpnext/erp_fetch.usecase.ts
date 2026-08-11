import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { ensureErpSidCookie } from "../auth/ensure_erp_sid_cookie.usecase";
import { getGiyaConnection } from "../auth/giya_erp_connection.usecase";
import { readErpIdentityCookies } from "../auth/read_erp_identity_cookies.usecase";

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
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

type CsrfCache = { sid: string; token: string; at: number };
let csrfCache: CsrfCache | null = null;

async function readCsrfCookie(site: string): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({ url: site, name: "csrf_token" });
    const raw = cookie?.value?.trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

async function writeCsrfCookie(site: string, token: string): Promise<void> {
  try {
    await chrome.cookies.set({
      url: site,
      name: "csrf_token",
      value: token,
      path: "/",
      secure: true,
      sameSite: "lax",
    });
  } catch {
    /* ignore */
  }
}

async function clearCsrfCookie(site: string): Promise<void> {
  try {
    await chrome.cookies.remove({ url: site, name: "csrf_token" });
  } catch {
    /* ignore */
  }
}

function scrapeCsrf(html: string): string | null {
  const patterns = [
    /frappe\.csrf_token\s*=\s*["']([^"']+)["']/,
    /csrf_token\s*=\s*["']([^"']+)["']/,
    /"csrf_token"\s*:\s*"([^"]+)"/,
  ];
  for (const re of patterns) {
    const match = re.exec(html);
    const token = match?.[1]?.trim();
    if (token && token !== "{{ csrf_token }}" && token.length >= 8) {
      return token;
    }
  }
  return null;
}

/**
 * Fresh CSRF from Desk `/app` boot (matches server session).
 * Do not trust a leftover csrf_token cookie — it often mismatches the sid session.
 */
async function ensureCsrfToken(
  site: string,
  options: { force?: boolean } = {}
): Promise<string | null> {
  const connection = await getGiyaConnection();
  const identity = await readErpIdentityCookies(site);
  const sid = (identity?.sid || connection?.sid || "").trim();
  if (!sid || sid === "Guest") return null;

  if (
    !options.force &&
    csrfCache &&
    csrfCache.sid === sid &&
    Date.now() - csrfCache.at < 5 * 60_000
  ) {
    return csrfCache.token;
  }

  await ensureErpSidCookie(site, sid, {
    userId: identity?.userId || connection?.email || undefined,
    fullName: identity?.fullName || connection?.fullName || undefined,
  });

  try {
    const res = await fetch(`${site}/app`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "text/html" },
    });
    const html = await res.text();

    // /app as Guest can Set-Cookie sid=Guest — put Connect sid back.
    await ensureErpSidCookie(site, sid, {
      userId: identity?.userId || connection?.email || undefined,
      fullName: identity?.fullName || connection?.fullName || undefined,
    });

    const token = scrapeCsrf(html);
    if (token) {
      csrfCache = { sid, token, at: Date.now() };
      await writeCsrfCookie(site, token);
      return token;
    }
  } catch {
    await ensureErpSidCookie(site, sid, {
      userId: identity?.userId || connection?.email || undefined,
      fullName: identity?.fullName || connection?.fullName || undefined,
    });
  }

  // Last resort only (often stale).
  return readCsrfCookie(site);
}

function injectCsrfIntoBody(init: RequestInit, csrf: string): RequestInit {
  const body = init.body;
  if (!body) return init;

  if (body instanceof FormData) {
    if (!body.has("csrf_token")) body.append("csrf_token", csrf);
    return init;
  }

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (parsed.csrf_token == null) parsed.csrf_token = csrf;
        return { ...init, body: JSON.stringify(parsed) };
      }
    } catch {
      /* not JSON */
    }
  }

  return init;
}

async function looksLikeCsrfFailure(res: Response): Promise<boolean> {
  if (res.status !== 400 && res.status !== 403) return false;
  try {
    const text = await res.clone().text();
    return /CSRFTokenError|csrf/i.test(text);
  } catch {
    return false;
  }
}

/**
 * Privileged extension fetch to erp.livro.systems.
 * Attaches sid via credentials + X-Frappe-CSRF-Token for mutating calls.
 */
export async function erpFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20_000
): Promise<Response> {
  const site = normalizeErpBaseUrl(url) || ERP_BASE_URL;
  const method = (init.method || "GET").toUpperCase();
  const needsCsrf = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("ERP_TIMEOUT"), timeoutMs);

  try {
    let requestInit = init;
    const headers = headersToRecord(init.headers);
    headers.Accept = headers.Accept || "application/json";
    if (init.body instanceof FormData) {
      delete headers["Content-Type"];
      delete headers["content-type"];
    }

    if (needsCsrf) {
      const csrf = await ensureCsrfToken(site);
      if (csrf) {
        headers["X-Frappe-CSRF-Token"] = csrf;
        requestInit = injectCsrfIntoBody(init, csrf);
      }
    }

    const doFetch = (next: RequestInit) =>
      fetch(url, {
        ...next,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers,
      });

    let res = await doFetch(requestInit);

    if (needsCsrf && (await looksLikeCsrfFailure(res))) {
      csrfCache = null;
      await clearCsrfCookie(site);
      const csrf = await ensureCsrfToken(site, { force: true });
      if (csrf) {
        headers["X-Frappe-CSRF-Token"] = csrf;
        requestInit = injectCsrfIntoBody(init, csrf);
        res = await doFetch(requestInit);
      }
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Map AbortError / timeouts to a short UI message. */
export function erpErrorMessage(error: unknown, fallback = "Livro ERP request failed."): string {
  if (!(error instanceof Error)) return fallback;

  const name = error.name;
  const message = error.message || "";
  const cause = String((error as { cause?: unknown }).cause ?? "");

  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    message.includes("aborted") ||
    message.includes("ERP_TIMEOUT") ||
    cause.includes("ERP_TIMEOUT")
  ) {
    return "Livro ERP timed out. Retry.";
  }

  return message.trim() || fallback;
}
