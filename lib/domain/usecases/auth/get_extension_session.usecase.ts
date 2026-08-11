import type { AuthResult, ExtensionSession } from "../../../entities/auth.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getErpLoggedUser } from "../erpnext/get_logged_user.usecase";
import { ensureErpSidCookie } from "./ensure_erp_sid_cookie.usecase";
import { getGiyaConnection } from "./giya_erp_connection.usecase";
import { readErpIdentityCookies } from "./read_erp_identity_cookies.usecase";

const CACHE_TTL_MS = 45_000;

type SessionCache = {
  at: number;
  result: AuthResult<ExtensionSession>;
};

let memoryCache: SessionCache | null = null;

/** Fast path: cookie presence only (no network). */
export async function hasErpSidCookie(
  baseUrl: string = ERP_BASE_URL
): Promise<string | null> {
  const identity = await readErpIdentityCookies(baseUrl);
  return identity?.sid ?? null;
}

/**
 * Giya session = explicit Connect (chrome.storage) + Livro `sid` cookie.
 * Matches giya-ai: do not treat a stray Desk cookie as an extension login.
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

    const origin = normalizeErpBaseUrl(connection.baseUrl) || site;

    // Prefer cookie jar; re-hydrate from stored Connect SID when missing.
    let identity = await readErpIdentityCookies(origin);
    if (!identity?.sid && connection.sid) {
      await ensureErpSidCookie(origin, connection.sid, {
        userId: connection.email,
        fullName: connection.fullName,
      });
      identity = await readErpIdentityCookies(origin);
    }

    const sid = identity?.sid || connection.sid;
    if (!sid) {
      const result: AuthResult<ExtensionSession> = {
        ok: false,
        error: "Login required.",
      };
      memoryCache = { at: Date.now(), result };
      return result;
    }

    if (identity?.userId) {
      const result: AuthResult<ExtensionSession> = {
        ok: true,
        data: {
          email: identity.userId,
          sid,
          baseUrl: origin,
        },
      };
      memoryCache = { at: Date.now(), result };
      return result;
    }

    const logged = await getErpLoggedUser(origin, sid);
    if (logged.ok) {
      const result: AuthResult<ExtensionSession> = {
        ok: true,
        data: {
          email: logged.data.email,
          sid,
          baseUrl: origin,
        },
      };
      memoryCache = { at: Date.now(), result };
      return result;
    }

    if (logged.error.includes("timed out")) {
      const result: AuthResult<ExtensionSession> = {
        ok: true,
        data: {
          email: connection.email,
          sid,
          baseUrl: origin,
        },
      };
      memoryCache = { at: Date.now(), result };
      return result;
    }

    // Stored Connect SID is authoritative when cookie/network checks flake.
    if (connection.sid) {
      const result: AuthResult<ExtensionSession> = {
        ok: true,
        data: {
          email: connection.email,
          sid: connection.sid,
          baseUrl: origin,
        },
      };
      memoryCache = { at: Date.now(), result };
      return result;
    }

    const result: AuthResult<ExtensionSession> = logged;
    memoryCache = { at: Date.now(), result };
    return result;
  } catch (error) {
    const result: AuthResult<ExtensionSession> = {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read ERP session.",
    };
    memoryCache = { at: Date.now(), result };
    return result;
  }
}

export function clearSessionCache(): void {
  memoryCache = null;
}
