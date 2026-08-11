import type {
  Concern,
  GiyaPinComment,
  GiyaPinPayload,
} from "../../lib/entities/concern.type";
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
    if (text.includes("Extension context invalidated")) return null;
    throw error;
  }
}

export async function listConcerns(): Promise<
  { ok: true; concerns: Concern[] } | { ok: false; error: string }
> {
  const response = await sendMessage({ type: "LIST_CONCERNS" });
  if (response?.type === "CONCERNS") {
    if (response.ok) return { ok: true, concerns: response.concerns };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Giya was updated." };
}

export async function createConcern(input: {
  subject: string;
  type?: string;
  priority?: string;
  description?: string;
}): Promise<{ ok: true; concern: Concern } | { ok: false; error: string }> {
  const response = await sendMessage({
    type: "CREATE_CONCERN",
    subject: input.subject,
    concernType: input.type,
    priority: input.priority,
    description: input.description,
  });
  if (response?.type === "CONCERN_CREATED") {
    if (response.ok) return { ok: true, concern: response.concern };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Giya was updated." };
}

export async function listPagePins(href: string): Promise<
  { ok: true; pins: GiyaPinComment[] } | { ok: false; error: string }
> {
  const response = await sendMessage({ type: "LIST_PAGE_PINS", href });
  if (response?.type === "PAGE_PINS") {
    if (response.ok) return { ok: true, pins: response.pins };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Giya was updated." };
}

export async function addConcernPin(
  concernName: string,
  pin: GiyaPinPayload
): Promise<{ ok: true; commentName: string } | { ok: false; error: string }> {
  const response = await sendMessage({
    type: "ADD_CONCERN_PIN",
    concernName,
    pin,
  });
  if (response?.type === "PIN_SAVED") {
    if (response.ok) return { ok: true, commentName: response.commentName };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Giya was updated." };
}
