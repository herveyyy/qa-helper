import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";

/**
 * Resolve the latest Livro Sprint name (e.g. Sprint_14_R&D).
 * DocType: Sprint — used as Sprint Backlogs.sprint_assign.
 */
export async function getLatestSprintAssign(
  baseUrl: string
): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
  try {
    const res = await erpFetch(
      `${baseUrl}/api/method/frappe.client.get_list`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Sprint",
          fields: ["name"],
          order_by: "creation desc",
          limit_page_length: 1,
        }),
      },
      12_000
    );

    if (!res.ok) {
      return { ok: false, error: `Could not load latest sprint (${res.status}).` };
    }

    const json = (await res.json()) as { message?: { name?: string }[] };
    const name = Array.isArray(json.message) ? json.message[0]?.name?.trim() : "";
    if (!name) {
      return { ok: false, error: "No Sprint found." };
    }

    return { ok: true, data: name };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to resolve latest sprint."),
    };
  }
}
