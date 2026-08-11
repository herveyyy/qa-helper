import type { Concern, ConcernResult } from "../../../entities/concern.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";
import { getLatestSprintAssign } from "./get_latest_sprint_assign.usecase";

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

/**
 * Open Sprint Backlogs for the logged-in user as current_assignee
 * on the latest Sprint (e.g. Sprint_14_R&D).
 */
export async function listAssigneeConcerns(
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<Concern[]>> {
  const site = normalizeErpBaseUrl(baseUrl);
  if (!site) return { ok: false, error: "Invalid ERP URL." };

  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const email = session.data.email;
  const sprint = await getLatestSprintAssign(site);
  if (!sprint.ok) return sprint;

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
          filters: [
            ["current_assignee", "=", email],
            ["sprint_assign", "=", sprint.data],
            ["status", "not in", ["Completed", "Cancelled", "Closed"]],
          ],
          order_by: "modified desc",
          limit_page_length: 50,
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
