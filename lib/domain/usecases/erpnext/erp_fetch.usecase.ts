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

/**
 * Privileged extension fetch to erp.livro.systems.
 * Attaches sid via credentials + X-Frappe-CSRF-Token for mutating calls.
 * Never calls get_logged_user (that caused AUTH cookie storms).
 */
export async function erpFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000
): Promise<Response> {
  const site = normalizeErpBaseUrl(url) || ERP_BASE_URL;
  const method = (init.method || "GET").toUpperCase();
  const needsCsrf = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  const csrf = needsCsrf ? await readCsrfToken(site) : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("ERP_TIMEOUT"), timeoutMs);

  try {
    const headers = headersToRecord(init.headers);
    headers.Accept = headers.Accept || "application/json";
    if (csrf) {
      headers["X-Frappe-CSRF-Token"] = csrf;
    }
    // Let the browser set multipart boundary for FormData uploads.
    if (init.body instanceof FormData) {
      delete headers["Content-Type"];
      delete headers["content-type"];
    }

    return await fetch(url, {
      ...init,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers,
    });
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
