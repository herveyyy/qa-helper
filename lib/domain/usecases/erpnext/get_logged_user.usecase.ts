import type { AuthResult } from "../../../entities/auth.type";
import { normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { erpFetch } from "./erp_fetch.usecase";

/** Resolve the logged-in ERP user from the browser sid cookie (giya-ai pattern). */
export async function getErpLoggedUser(
  baseUrl: string,
  _sid?: string
): Promise<AuthResult<{ email: string }>> {
  const site = normalizeErpBaseUrl(baseUrl);
  if (!site) return { ok: false, error: "Invalid ERPNext base URL." };

  try {
    const res = await erpFetch(`${site}/api/method/frappe.auth.get_logged_user`);

    if (!res.ok) {
      return { ok: false, error: res.status >= 500 ? "ERP unreachable." : "Session expired." };
    }

    const json = (await res.json()) as { message?: string };
    const email = typeof json.message === "string" ? json.message.trim() : "";
    if (!email || email === "Guest") {
      return { ok: false, error: "Session expired." };
    }

    return { ok: true, data: { email } };
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return { ok: false, error: `ERP at ${site} timed out while checking sid.` };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "ERPNext session check failed.",
    };
  }
}
