import type { ExtensionSession } from "../../lib/entities/auth.type";
import type { GiyaErpConnection } from "../../lib/entities/giya_connection.type";
import type { UserProfile } from "../../lib/entities/user.type";
import type { ExtensionRequest, ExtensionResponse } from "../shared/messages.ts";

function extensionAlive(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

async function sendMessage(
  message: ExtensionRequest
): Promise<ExtensionResponse | null> {
  if (!extensionAlive()) return null;
  try {
    return (await chrome.runtime.sendMessage(message)) as ExtensionResponse;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (
      text.includes("Extension context invalidated") ||
      text.includes("message channel closed") ||
      text.includes("Receiving end does not exist")
    ) {
      return null;
    }
    throw error;
  }
}

export async function peekSid(): Promise<boolean> {
  const response = await sendMessage({ type: "PEEK_SID" });
  return response?.type === "PEEK_SID" ? response.hasSid : false;
}

export async function fetchSession(force = false): Promise<
  { ok: true; session: ExtensionSession } | { ok: false; error: string }
> {
  const response = await sendMessage({ type: "GET_SESSION", force });

  if (response?.type === "SESSION") {
    if (response.ok) return { ok: true, session: response.session };
    return { ok: false, error: response.error };
  }

  return { ok: false, error: "Reload this page — Giya was updated." };
}

export async function fetchUserProfile(): Promise<
  { ok: true; profile: UserProfile } | { ok: false; error: string }
> {
  const response = await sendMessage({ type: "GET_USER_PROFILE" });

  if (response?.type === "USER_PROFILE") {
    if (response.ok) return { ok: true, profile: response.profile };
    return { ok: false, error: response.error };
  }

  return { ok: false, error: "Profile unavailable." };
}

export async function connectErpPassword(
  usr: string,
  pwd: string
): Promise<
  | { ok: true; needsOtp: true; tmpId: string; prompt: string; method: string }
  | { ok: true; needsOtp?: false; connection: GiyaErpConnection }
  | { ok: false; error: string }
> {
  const response = await sendMessage({ type: "CONNECT_ERP", usr, pwd });
  if (response?.type !== "CONNECT_ERP") {
    return { ok: false, error: "Reload this page — Giya was updated." };
  }
  if (!response.ok) return { ok: false, error: response.error };
  if (response.needsOtp) {
    return {
      ok: true,
      needsOtp: true,
      tmpId: response.tmpId,
      prompt: response.prompt,
      method: response.method,
    };
  }
  return { ok: true, connection: response.connection };
}

export async function connectErpOtp(
  tmpId: string,
  otp: string,
  usr?: string
): Promise<
  | { ok: true; connection: GiyaErpConnection }
  | { ok: false; error: string }
> {
  const response = await sendMessage({ type: "CONNECT_ERP", tmpId, otp, usr });
  if (response?.type !== "CONNECT_ERP") {
    return { ok: false, error: "Reload this page — Giya was updated." };
  }
  if (!response.ok) return { ok: false, error: response.error };
  if (response.needsOtp) {
    return { ok: false, error: "Still waiting for verification." };
  }
  return { ok: true, connection: response.connection };
}

export async function connectErpFromDesk(): Promise<
  { ok: true; connection: GiyaErpConnection } | { ok: false; error: string }
> {
  const response = await sendMessage({ type: "CONNECT_ERP_DESK" });
  if (response?.type !== "CONNECT_ERP") {
    return { ok: false, error: "Reload this page — Giya was updated." };
  }
  if (!response.ok) return { ok: false, error: response.error };
  if (response.needsOtp) {
    return { ok: false, error: "Unexpected OTP step." };
  }
  return { ok: true, connection: response.connection };
}

export async function disconnectErp(): Promise<void> {
  await sendMessage({ type: "DISCONNECT_ERP" });
}

export async function openLivroLoginTab(): Promise<void> {
  await sendMessage({ type: "OPEN_LIVRO_LOGIN" });
}
