import type { AuthResult } from "../../../entities/auth.type";
import {
  GIYA_CONNECTION_KEY,
  type GiyaErpConnection,
} from "../../../entities/giya_connection.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getErpLoggedUser } from "../erpnext/get_logged_user.usecase";
import { loginLivroErp, type LivroLoginInput } from "../erpnext/login_livro.usecase";
import { ensureErpSidCookie } from "./ensure_erp_sid_cookie.usecase";
import { clearSessionCache } from "./get_extension_session.usecase";
import { readErpIdentityCookies } from "./read_erp_identity_cookies.usecase";

export async function getGiyaConnection(): Promise<GiyaErpConnection | null> {
  const stored = await chrome.storage.local.get(GIYA_CONNECTION_KEY);
  const value = stored[GIYA_CONNECTION_KEY] as GiyaErpConnection | undefined;
  if (!value?.connected || !value.email || !value.baseUrl || !value.sid) return null;
  return value;
}

export async function clearGiyaConnection(): Promise<void> {
  await chrome.storage.local.remove(GIYA_CONNECTION_KEY);
  clearSessionCache();
}

async function saveConnection(
  email: string,
  fullName: string,
  baseUrl: string,
  sid: string
): Promise<GiyaErpConnection> {
  const connection: GiyaErpConnection = {
    connected: true,
    email,
    fullName,
    baseUrl,
    sid,
    connectedAt: Date.now(),
  };
  await ensureErpSidCookie(baseUrl, sid, { userId: email, fullName });
  await chrome.storage.local.set({ [GIYA_CONNECTION_KEY]: connection });
  clearSessionCache();
  return connection;
}

/** Password or OTP step — mirrors giya-ai connect. */
export async function connectLivroErp(
  input: LivroLoginInput
): Promise<
  AuthResult<
    | { needsOtp: true; tmpId: string; prompt: string; method: string }
    | { needsOtp?: false; connection: GiyaErpConnection }
  >
> {
  const result = await loginLivroErp(input);
  if (!result.ok) return result;

  if ("needsOtp" in result.data && result.data.needsOtp) {
    return {
      ok: true,
      data: {
        needsOtp: true,
        tmpId: result.data.tmpId,
        prompt: result.data.prompt,
        method: result.data.method,
      },
    };
  }

  const success = result.data;
  if (!("sid" in success) || !success.sid) {
    return { ok: false, error: "Login failed — no SID returned." };
  }

  // Cookie must be in the jar before get_logged_user (erpFetch uses credentials).
  await ensureErpSidCookie(success.baseUrl, success.sid, {
    userId: success.email,
    fullName: success.fullName,
  });

  const logged = await getErpLoggedUser(success.baseUrl, success.sid);
  const email = logged.ok ? logged.data.email : success.email;
  const connection = await saveConnection(
    email,
    success.fullName,
    success.baseUrl,
    success.sid
  );
  return { ok: true, data: { connection } };
}

/**
 * Explicit “use current Desk session” — still requires a click (not silent).
 * Validates sid via get_logged_user then marks Giya connected.
 */
export async function connectWithDeskSid(
  baseUrl: string = ERP_BASE_URL
): Promise<AuthResult<GiyaErpConnection>> {
  const site = normalizeErpBaseUrl(baseUrl);
  if (!site) return { ok: false, error: "Invalid ERP URL." };

  const identity = await readErpIdentityCookies(site);
  if (!identity) {
    return { ok: false, error: "No Livro SID in this browser. Sign in below." };
  }

  const logged = await getErpLoggedUser(site, identity.sid);
  const email = logged.ok
    ? logged.data.email
    : identity.userId || "";
  if (!email || email === "Guest") {
    return {
      ok: false,
      error: logged.ok ? "Session expired." : logged.error,
    };
  }

  const connection = await saveConnection(
    email,
    identity.fullName || email,
    site,
    identity.sid
  );
  return { ok: true, data: connection };
}

export async function disconnectLivroErp(): Promise<void> {
  await clearGiyaConnection();
}
