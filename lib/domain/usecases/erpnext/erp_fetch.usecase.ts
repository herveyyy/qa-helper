import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";

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

async function readCsrfToken(site: string): Promise<string | null> {
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
    if (token) return token;
  }
  return null;
}

/** Warm csrf_token cookie when Connect/Desk left the jar without one. */
async function ensureCsrfToken(site: string): Promise<string | null> {
  const existing = await readCsrfToken(site);
  if (existing) return existing;

  try {
    // Authenticated GET — no CSRF header required; Frappe often sets the cookie.
    await fetch(`${site}/api/method/frappe.auth.get_logged_user`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    /* ignore */
  }

  let token = await readCsrfToken(site);
  if (token) return token;

  try {
    const res = await fetch(`${site}/app`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    const html = await res.text();
    token = scrapeCsrf(html) || (await readCsrfToken(site));
    if (token) await writeCsrfCookie(site, token);
    return token;
  } catch {
    return readCsrfToken(site);
  }
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
  timeoutMs = 15_000
): Promise<Response> {
  const site = normalizeErpBaseUrl(url) || ERP_BASE_URL;
  const method = (init.method || "GET").toUpperCase();
  const needsCsrf = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("ERP_TIMEOUT"), timeoutMs);

  try {
    const headers = headersToRecord(init.headers);
    headers.Accept = headers.Accept || "application/json";
    if (init.body instanceof FormData) {
      delete headers["Content-Type"];
      delete headers["content-type"];
    }

    if (needsCsrf) {
      const csrf = await ensureCsrfToken(site);
      if (csrf) headers["X-Frappe-CSRF-Token"] = csrf;
    }

    const doFetch = () =>
      fetch(url, {
        ...init,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers,
      });

    let res = await doFetch();

    // Stale csrf cookie → refresh once and retry.
    if (needsCsrf && (await looksLikeCsrfFailure(res))) {
      await clearCsrfCookie(site);
      const csrf = await ensureCsrfToken(site);
      if (csrf) {
        headers["X-Frappe-CSRF-Token"] = csrf;
        res = await doFetch();
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
