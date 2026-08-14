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
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function createConcern(input: {
  subject: string;
  type?: string;
  priority?: string;
  status?: string;
  description?: string;
}): Promise<{ ok: true; concern: Concern } | { ok: false; error: string }> {
  const response = await sendRuntimeMessage({
    type: "CREATE_CONCERN",
    subject: input.subject,
    concernType: input.type,
    priority: input.priority,
    status: input.status,
    description: input.description,
  });
  if (response?.type === "CONCERN_CREATED") {
    if (response.ok) return { ok: true, concern: response.concern };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function listPagePins(href: string): Promise<
  { ok: true; pins: GiyaPinComment[] } | { ok: false; error: string }
> {
  const response = await sendRuntimeMessage({ type: "LIST_PAGE_PINS", href });
  if (response?.type === "PAGE_PINS") {
    if (response.ok) return { ok: true, pins: response.pins };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
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
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function listPinThread(
  concernName: string,
  threadId: string
): Promise<{ ok: true; comments: GiyaPinComment[] } | { ok: false; error: string }> {
  const response = await sendRuntimeMessage({
    type: "LIST_PIN_THREAD",
    concernName,
    threadId,
  });
  if (response?.type === "PIN_THREAD") {
    if (response.ok) return { ok: true, comments: response.comments };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function getConcernDevops(
  concernName: string
): Promise<
  | { ok: true; devopsStatus: string; resolved: boolean }
  | { ok: false; error: string }
> {
  const response = await sendRuntimeMessage({
    type: "GET_CONCERN_DEVOPS",
    concernName,
  });
  if (response?.type === "CONCERN_DEVOPS") {
    if (response.ok) {
      return {
        ok: true,
        devopsStatus: response.devopsStatus,
        resolved: response.resolved,
      };
    }
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function resolveConcern(
  concernName: string
): Promise<
  | { ok: true; devopsStatus: string; resolved: boolean }
  | { ok: false; error: string }
> {
  const response = await sendRuntimeMessage({
    type: "RESOLVE_CONCERN",
    concernName,
  });
  if (response?.type === "CONCERN_DEVOPS") {
    if (response.ok) {
      return {
        ok: true,
        devopsStatus: response.devopsStatus,
        resolved: response.resolved,
      };
    }
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function getConcernFields(
  concernName: string
): Promise<
  | {
      ok: true;
      status: string;
      currentAssignee: string;
      devopsStatus: string;
    }
  | { ok: false; error: string }
> {
  const response = await sendRuntimeMessage({
    type: "GET_CONCERN_FIELDS",
    concernName,
  });
  if (response?.type === "CONCERN_FIELDS") {
    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        currentAssignee: response.currentAssignee,
        devopsStatus: response.devopsStatus,
      };
    }
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function setConcernField(
  concernName: string,
  fieldname: "status" | "current_assignee",
  value: string
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const response = await sendRuntimeMessage({
    type: "SET_CONCERN_FIELD",
    concernName,
    fieldname,
    value,
  });
  if (response?.type === "CONCERN_FIELD_SET") {
    if (response.ok) return { ok: true, value: response.value };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function getSpbStatusOptions(): Promise<
  { ok: true; options: string[] } | { ok: false; error: string }
> {
  const response = await sendRuntimeMessage({ type: "GET_SPB_STATUS_OPTIONS" });
  if (response?.type === "SPB_STATUS_OPTIONS") {
    if (response.ok) return { ok: true, options: response.options };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function searchErpUsers(
  query: string
): Promise<
  | { ok: true; users: Array<{ email: string; fullName: string }> }
  | { ok: false; error: string }
> {
  const response = await sendRuntimeMessage({
    type: "SEARCH_ERP_USERS",
    query,
  });
  if (response?.type === "ERP_USERS") {
    if (response.ok) return { ok: true, users: response.users };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
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
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function captureVisibleTab(): Promise<
  { ok: true; dataUrl: string } | { ok: false; error: string }
> {
  const response = await sendRuntimeMessage({ type: "CAPTURE_VISIBLE_TAB" });
  if (response?.type === "TAB_CAPTURE") {
    if (response.ok) return { ok: true, dataUrl: response.dataUrl };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
}

export async function fetchErpFileDataUrl(
  url: string
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  const response = await sendRuntimeMessage({
    type: "FETCH_ERP_FILE_DATA",
    url,
  });
  if (response?.type === "ERP_FILE_DATA") {
    if (response.ok) return { ok: true, dataUrl: response.dataUrl };
    return { ok: false, error: response.error };
  }
  return { ok: false, error: "Reload this page — Faye was updated." };
}
