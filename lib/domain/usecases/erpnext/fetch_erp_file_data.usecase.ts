import type { AuthResult } from "../../../entities/auth.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "./erp_fetch.usecase";

export type ErpFileData = {
  dataUrl: string;
  mimeType: string;
};

/** Fetch a Livro file (incl. /private/files) with session cookies → data URL for widget preview. */
export async function fetchErpFileDataUrl(
  fileUrl: string,
  baseUrl: string = ERP_BASE_URL
): Promise<AuthResult<ErpFileData>> {
  const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const raw = fileUrl.trim();
  if (!raw) return { ok: false, error: "Missing file URL." };

  let absolute = raw;
  if (raw.startsWith("/")) absolute = `${site}${raw}`;
  try {
    const host = new URL(absolute).hostname.toLowerCase();
    if (host !== "erp.livro.systems" && host !== "www.erp.livro.systems") {
      return { ok: false, error: "Only Livro file URLs can be loaded." };
    }
  } catch {
    return { ok: false, error: "Invalid file URL." };
  }

  try {
    const res = await erpFetch(absolute, { method: "GET" }, 30_000);
    if (!res.ok) {
      return { ok: false, error: `Could not load image (${res.status}).` };
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 6 * 1024 * 1024) {
      return { ok: false, error: "Image too large to preview." };
    }
    const mimeType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return {
      ok: true,
      data: {
        mimeType,
        dataUrl: `data:${mimeType};base64,${btoa(binary)}`,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to load image."),
    };
  }
}
