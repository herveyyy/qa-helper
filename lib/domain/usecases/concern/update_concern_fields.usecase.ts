import type { ConcernResult } from "../../../entities/concern.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";
import { readErpError } from "./list_assignee_concerns.usecase";

export type ConcernFields = {
  status: string;
  currentAssignee: string;
  devopsStatus: string;
};

export type ErpUserHit = {
  email: string;
  fullName: string;
};

/** Known SPB statuses; get_meta may extend this. */
export const FALLBACK_SPB_STATUSES = [
  "Open",
  "Working",
  "Pending Review",
  "Completed",
  "Cancelled",
  "Closed",
];

export async function getConcernFields(
  concernName: string,
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<ConcernFields>> {
  const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const name = concernName.trim();
  if (!name) return { ok: false, error: "Missing concern." };

  try {
    const params = new URLSearchParams({
      doctype: "Sprint Backlogs",
      fields: JSON.stringify([
        "name",
        "status",
        "current_assignee",
        "devops_status",
      ]),
      filters: JSON.stringify([["name", "=", name]]),
      limit_page_length: "1",
    });
    const res = await erpFetch(
      `${site}/api/method/frappe.client.get_list?${params}`,
      { method: "GET" },
      12_000
    );
    if (!res.ok) {
      return { ok: false, error: `Could not read concern (${res.status}).` };
    }
    const json = (await res.json()) as {
      message?: Array<{
        status?: string | null;
        current_assignee?: string | null;
        devops_status?: string | null;
      }>;
      exc?: string;
    };
    if (json.exc) return { ok: false, error: "Could not read concern fields." };
    const row = Array.isArray(json.message) ? json.message[0] : undefined;
    return {
      ok: true,
      data: {
        status: String(row?.status || "").trim() || "Open",
        currentAssignee: String(row?.current_assignee || "").trim(),
        devopsStatus: String(row?.devops_status || "").trim(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to read concern."),
    };
  }
}

export async function setConcernField(
  concernName: string,
  fieldname: "status" | "current_assignee",
  value: string,
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<{ fieldname: string; value: string }>> {
  const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const name = concernName.trim();
  const next = value.trim();
  if (!name) return { ok: false, error: "Missing concern." };
  if (fieldname === "current_assignee" && !next) {
    return { ok: false, error: "Pick an assignee." };
  }
  if (fieldname === "status" && !next) {
    return { ok: false, error: "Pick a status." };
  }

  try {
    const res = await erpFetch(`${site}/api/method/frappe.client.set_value`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctype: "Sprint Backlogs",
        name,
        fieldname,
        value: next,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `Could not update ${fieldname} (${res.status}).` };
    }
    const json = (await res.json()) as { exc?: string; message?: unknown };
    if (json.exc) {
      return { ok: false, error: `Could not update ${fieldname}.` };
    }
    return { ok: true, data: { fieldname, value: next } };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, `Failed to update ${fieldname}.`),
    };
  }
}

export async function getSpbStatusOptions(
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<string[]>> {
  const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  try {
    const res = await erpFetch(`${site}/api/method/frappe.get_meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctype: "Sprint Backlogs" }),
    });
    if (!res.ok) {
      return { ok: true, data: [...FALLBACK_SPB_STATUSES] };
    }
    const json = (await res.json()) as {
      message?: {
        fields?: Array<{ fieldname?: string; options?: string | null }>;
      };
    };
    const field = json.message?.fields?.find((f) => f.fieldname === "status");
    const fromMeta = String(field?.options || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = Array.from(
      new Set([...FALLBACK_SPB_STATUSES, ...fromMeta])
    );
    return { ok: true, data: fromMeta.length ? fromMeta : merged };
  } catch {
    return { ok: true, data: [...FALLBACK_SPB_STATUSES] };
  }
}

export async function searchErpUsers(
  query: string,
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<ErpUserHit[]>> {
  const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const txt = query.trim();
  try {
    const filters: Array<[string, string, string | number]> = [
      ["enabled", "=", 1],
    ];
    if (txt) filters.push(["full_name", "like", `%${txt}%`]);

    const params = new URLSearchParams({
      doctype: "User",
      fields: JSON.stringify(["name", "full_name"]),
      filters: JSON.stringify(filters),
      order_by: "full_name asc",
      limit_page_length: "12",
    });

    const res = await erpFetch(
      `${site}/api/method/frappe.client.get_list?${params}`,
      { method: "GET" },
      12_000
    );
    if (!res.ok) {
      const detail = await readErpError(res);
      return {
        ok: false,
        error: detail || `User search failed (${res.status}).`,
      };
    }
    const json = (await res.json()) as {
      message?: Array<{ name?: string; full_name?: string | null }>;
      exc?: string;
    };
    if (json.exc) return { ok: false, error: "User search failed." };
    const hits = (Array.isArray(json.message) ? json.message : [])
      .map((row) => {
        const email = String(row.name || "").trim();
        if (!email) return null;
        return { email, fullName: String(row.full_name || "").trim() || email };
      })
      .filter((x): x is ErpUserHit => Boolean(x));
    return { ok: true, data: hits };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to search users."),
    };
  }
}
