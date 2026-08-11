import type { ConcernResult } from "../../../entities/concern.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";

export type ConcernDevopsState = {
  devopsStatus: string;
  /** Empty / missing devops_status ⇒ not resolved yet. */
  resolved: boolean;
};

export function isDevopsResolved(status: string | null | undefined): boolean {
  return Boolean(String(status || "").trim());
}

export async function getConcernDevopsStatus(
  concernName: string,
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<ConcernDevopsState>> {
  const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const name = concernName.trim();
  if (!name) return { ok: false, error: "Missing concern." };

  try {
    const params = new URLSearchParams({
      doctype: "Sprint Backlogs",
      fields: JSON.stringify(["name", "devops_status"]),
      filters: JSON.stringify([["name", "=", name]]),
      limit_page_length: "1",
    });
    const res = await erpFetch(
      `${site}/api/method/frappe.client.get_list?${params}`,
      { method: "GET" },
      12_000
    );
    if (!res.ok) {
      return { ok: false, error: `Could not read status (${res.status}).` };
    }
    const json = (await res.json()) as {
      message?: Array<{ devops_status?: string | null }>;
      exc?: string;
    };
    if (json.exc) {
      return { ok: false, error: "Could not read DevOps status." };
    }
    const row = Array.isArray(json.message) ? json.message[0] : undefined;
    const devopsStatus = String(row?.devops_status || "").trim();
    return {
      ok: true,
      data: {
        devopsStatus,
        resolved: isDevopsResolved(devopsStatus),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to read DevOps status."),
    };
  }
}

/** Mark resolved ⇒ set DevOps Status to For Staging Update. */
export async function resolveConcernForStaging(
  concernName: string,
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<ConcernDevopsState>> {
  const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const name = concernName.trim();
  if (!name) return { ok: false, error: "Missing concern." };

  const current = await getConcernDevopsStatus(name, site);
  if (!current.ok) return current;
  if (current.data.resolved) return { ok: true, data: current.data };

  try {
    const res = await erpFetch(`${site}/api/method/frappe.client.set_value`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctype: "Sprint Backlogs",
        name,
        fieldname: "devops_status",
        value: "For Staging Update",
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `Could not resolve (${res.status}).` };
    }

    const json = (await res.json()) as { exc?: string };
    if (json.exc) {
      return { ok: false, error: "Could not update DevOps status." };
    }

    return {
      ok: true,
      data: {
        devopsStatus: "For Staging Update",
        resolved: true,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to mark resolved."),
    };
  }
}
