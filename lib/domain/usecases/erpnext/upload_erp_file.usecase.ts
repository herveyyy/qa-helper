import type { AuthResult } from "../../../entities/auth.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "./erp_fetch.usecase";

export type UploadErpFileInput = {
  filename: string;
  mimeType: string;
  /** Raw file bytes as base64 (no data: prefix). */
  base64: string;
  doctype?: string;
  docname?: string;
  isPrivate?: boolean;
};

export type UploadedErpFile = {
  fileUrl: string;
  fileName: string;
};

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Upload to Livro via `/api/method/upload_file` (same path Desk comments use). */
export async function uploadErpFile(
  input: UploadErpFileInput,
  baseUrl: string = ERP_BASE_URL
): Promise<AuthResult<UploadedErpFile>> {
  const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const filename = input.filename.trim() || "upload.bin";
  if (!input.base64) return { ok: false, error: "No file data." };

  try {
    const bytes = decodeBase64(input.base64);
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: input.mimeType || "application/octet-stream",
    });
    const form = new FormData();
    form.append("file", blob, filename);
    form.append("is_private", input.isPrivate === false ? "0" : "1");
    form.append("folder", "Home/Attachments");
    if (input.doctype) form.append("doctype", input.doctype);
    if (input.docname) form.append("docname", input.docname);

    const res = await erpFetch(
      `${site}/api/method/upload_file`,
      { method: "POST", body: form },
      60_000
    );

    if (!res.ok) {
      return { ok: false, error: `Upload failed (${res.status}).` };
    }

    const json = (await res.json()) as {
      message?: {
        file_url?: string;
        file_name?: string;
        name?: string;
      };
      exc?: string;
    };

    if (json.exc) {
      return { ok: false, error: "Upload rejected by Livro." };
    }

    const fileUrl = json.message?.file_url?.trim() || "";
    if (!fileUrl) return { ok: false, error: "Upload succeeded but no file URL." };

    const absolute = fileUrl.startsWith("http")
      ? fileUrl
      : `${site}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;

    return {
      ok: true,
      data: {
        fileUrl: absolute,
        fileName: json.message?.file_name || filename,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to upload file."),
    };
  }
}
