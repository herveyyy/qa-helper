import type { Concern, ConcernResult } from "../../../entities/concern.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";

const ASSIGNEE_FIELDS = [
  "dev_assignee",
  "current_assignee",
  "qa_assignee",
  "tech_assignee",
  "product_owner",
  "project_manager",
] as const;

type SpbRow = {
  name?: string;
  subject?: string;
  status?: string;
  type?: string;
  priority?: string;
  sprint_assign?: string | null;
  dev_assignee?: string | null;
  current_assignee?: string | null;
};

/** Open/active Sprint Backlogs where the logged-in user is any assignee. */
export async function listAssigneeConcerns(
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<Concern[]>> {
  const site = normalizeErpBaseUrl(baseUrl);
  if (!site) return { ok: false, error: "Invalid ERP URL." };

  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const email = session.data.email;
  const orFilters = ASSIGNEE_FIELDS.map((field) => [field, "=", email]);

  try {
    const url = `${site}/api/method/frappe.client.get_list`;
    const res = await erpFetch(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Sprint Backlogs",
          fields: [
            "name",
            "subject",
            "status",
            "type",
            "priority",
            "sprint_assign",
            "dev_assignee",
            "current_assignee",
          ],
          filters: [["status", "not in", ["Completed", "Cancelled", "Closed"]]],
          or_filters: orFilters,
          order_by: "modified desc",
          limit_page_length: 25,
        }),
      },
      15_000
    );

    if (!res.ok) {
      return { ok: false, error: `Could not load concerns (${res.status}).` };
    }

    const json = (await res.json()) as { message?: SpbRow[] };
    const rows = Array.isArray(json.message) ? json.message : [];

    return {
      ok: true,
      data: rows
        .filter((row) => row.name && row.subject)
        .map((row) => ({
          name: String(row.name),
          subject: String(row.subject),
          status: String(row.status || ""),
          type: String(row.type || ""),
          priority: String(row.priority || ""),
          sprintAssign: row.sprint_assign || null,
          devAssignee: row.dev_assignee || null,
          currentAssignee: row.current_assignee || null,
        })),
    };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to list concerns."),
    };
  }
}
