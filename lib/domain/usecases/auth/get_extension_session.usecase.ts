import type { AuthResult, ExtensionSession } from "../../../entities/auth.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { ensureErpSidCookie } from "./ensure_erp_sid_cookie.usecase";
import { getGiyaConnection } from "./giya_erp_connection.usecase";
import { readErpIdentityCookies } from "./read_erp_identity_cookies.usecase";

const CACHE_TTL_MS = 60_000;

type SessionCache = {
  at: number;
  result: AuthResult<ExtensionSession>;
};

let memoryCache: SessionCache | null = null;
let inflight: Promise<AuthResult<ExtensionSession>> | null = null;

/** Fast path: cookie presence only (no network). */
export async function hasErpSidCookie(
  baseUrl: string = ERP_BASE_URL
): Promise<string | null> {
  const identity = await readErpIdentityCookies(baseUrl);
  return identity?.sid ?? null;
}

/**
 * Giya session = explicit Connect + Livro SID cookie (CSRF optional).
 * No frappe.auth.get_logged_user — that method is not whitelisted for Guest/
 * cross-origin and was causing lag + permission errors.
 */
export async function getExtensionSession(
  baseUrl: string = ERP_BASE_URL,
  options: { force?: boolean } = {}
): Promise<AuthResult<ExtensionSession>> {
  const site = normalizeErpBaseUrl(baseUrl);
  if (!site) return { ok: false, error: "ERP URL is not configured." };

  if (
    !options.force &&
    memoryCache &&
    Date.now() - memoryCache.at < CACHE_TTL_MS
  ) {
    return memoryCache.result;
  }

  if (inflight) return inflight;

  inflight = resolveSession(site).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function resolveSession(
  site: string
): Promise<AuthResult<ExtensionSession>> {
  try {
    const connection = await getGiyaConnection();
    if (!connection) {
      const result: AuthResult<ExtensionSession> = {
        ok: false,
        error: "Connect Livro in Giya first.",
      };
      memoryCache = { at: Date.now(), result };
      return result;
    }

    // Always Livro ERP — never the host page (e.g. *.wela.dev).
    const origin = ERP_BASE_URL;

    let identity = await readErpIdentityCookies(origin);
    const cookieMatches =
      Boolean(identity?.sid && connection.sid) &&
      identity!.sid === connection.sid;

    // Restore Connect SID only when jar is empty or mismatched (no rewrite storm).
    if (!cookieMatches) {
      await ensureErpSidCookie(origin, connection.sid, {
        userId: connection.email,
        fullName: connection.fullName,
      });
      identity = await readErpIdentityCookies(origin);
    }

    const sid = identity?.sid || "";
    if (!sid || sid === "Guest") {
      const result: AuthResult<ExtensionSession> = {
        ok: false,
        error: "Login required.",
      };
      memoryCache = { at: Date.now(), result };
      return result;
    }

    // Prefer cookie user_id; fall back to Connect email.
    const email =
      (identity?.userId && identity.userId !== "Guest"
        ? identity.userId
        : connection.email) || "";
    if (!email || email === "Guest") {
      const result: AuthResult<ExtensionSession> = {
        ok: false,
        error: "Connect Livro in Giya first.",
      };
      memoryCache = { at: Date.now(), result };
      return result;
    }

    const result: AuthResult<ExtensionSession> = {
      ok: true,
      data: {
        email,
        sid: connection.sid,
        baseUrl: origin,
      },
    };
    memoryCache = { at: Date.now(), result };
    return result;
  } catch (error) {
    const result: AuthResult<ExtensionSession> = {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to read ERP session.",
    };
    memoryCache = { at: Date.now(), result };
    return result;
  }
}

export function clearSessionCache(): void {
  memoryCache = null;
  inflight = null;
}
