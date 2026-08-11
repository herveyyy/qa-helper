import type { AuthResult, ExtensionSession } from "../../entities/auth.type";
import type { GiyaErpConnection } from "../../entities/giya_connection.type";
import { ERP_BASE_URL, erpLoginUrl } from "../../entities/erpnext.type";
import {
  connectLivroErp,
  connectWithDeskSid,
  disconnectLivroErp,
  getGiyaConnection,
} from "../usecases/auth/giya_erp_connection.usecase";
import {
  clearSessionCache,
  getExtensionSession as getExtensionSessionUseCase,
} from "../usecases/auth/get_extension_session.usecase";
import type { LivroLoginInput } from "../usecases/erpnext/login_livro.usecase";
import { invalidateConcernCaches } from "./concern.service";

export async function getSession(
  baseUrl: string = ERP_BASE_URL,
  options: { force?: boolean } = {}
): Promise<AuthResult<ExtensionSession>> {
  return getExtensionSessionUseCase(baseUrl, options);
}

export async function peekSid(_baseUrl: string = ERP_BASE_URL): Promise<boolean> {
  // Explicit Connect stores SID in chrome.storage — that is the auth gate.
  const connection = await getGiyaConnection();
  return Boolean(connection?.sid);
}

export async function peekConnection(): Promise<GiyaErpConnection | null> {
  return getGiyaConnection();
}

export async function connectErp(
  input: LivroLoginInput
): Promise<
  AuthResult<
    | { needsOtp: true; tmpId: string; prompt: string; method: string }
    | { needsOtp?: false; connection: GiyaErpConnection }
  >
> {
  const result = await connectLivroErp(input);
  if (result.ok && !("needsOtp" in result.data && result.data.needsOtp)) {
    invalidateConcernCaches();
  }
  return result;
}

export async function connectErpFromDesk(
  baseUrl: string = ERP_BASE_URL
): Promise<AuthResult<GiyaErpConnection>> {
  const result = await connectWithDeskSid(baseUrl);
  if (result.ok) invalidateConcernCaches();
  return result;
}

export async function disconnectErp(): Promise<void> {
  await disconnectLivroErp();
  invalidateConcernCaches();
}

export function openLivroLogin(baseUrl: string = ERP_BASE_URL): void {
  void chrome.tabs.create({ url: erpLoginUrl(baseUrl) });
}

export function openExtensionLoginPage(): void {
  void chrome.tabs.create({ url: chrome.runtime.getURL("pages/login.html") });
}

export function invalidateSessionCache(): void {
  clearSessionCache();
}
