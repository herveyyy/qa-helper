import type {
  Concern,
  GiyaPinComment,
  GiyaPinPayload,
} from "../../lib/entities/concern.type";
import { sendRuntimeMessage } from "../shared/runtime_message.ts";

export async function listConcerns(force = false): Promise<
  { ok: true; concerns: Concern[] } | { ok: false; error: string }
> {
  const response = await sendRuntimeMessage({ type: "LIST_CONCERNS", force });
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
  const response = await sendRuntimeMessage({
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
  const response = await sendRuntimeMessage({ type: "LIST_PAGE_PINS", href });
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
  const response = await sendRuntimeMessage({
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

export async function uploadErpFile(input: {
  file: File;
  doctype?: string;
  docname?: string;
  isPrivate?: boolean;
}): Promise<{ ok: true; fileUrl: string; fileName: string } | { ok: false; error: string }> {
  const maxBytes = 4 * 1024 * 1024;
  if (input.file.size > maxBytes) {
    return { ok: false, error: "Image too large (max 4 MB)." };
  }

  const buffer = await input.file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  const response = await sendRuntimeMessage({
    type: "UPLOAD_ERP_FILE",
    filename: input.file.name || "image.png",
    mimeType: input.file.type || "application/octet-stream",
    base64: btoa(binary),
    doctype: input.doctype,
    docname: input.docname,
    isPrivate: input.isPrivate,
  });

  if (response?.type === "ERP_FILE") {
    if (response.ok) {
      return { ok: true, fileUrl: response.fileUrl, fileName: response.fileName };
    }
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Giya was updated." };
}
