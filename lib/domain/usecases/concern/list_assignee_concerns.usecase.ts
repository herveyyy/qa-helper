import type { Concern, ConcernResult } from "../../../entities/concern.type";
import { ERP_BASE_URL } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";

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

const DONE_STATUSES = new Set(["completed", "cancelled", "closed"]);

/**
 * Open Sprint Backlogs where the signed-in user is current_assignee.
 * Uses GET (no CSRF) against erp.livro.systems only.
 */
export async function listAssigneeConcerns(
  _baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<Concern[]>> {
  void _baseUrl;
  const site = ERP_BASE_URL;

  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  let email = session.data.email.trim();
  try {
    email = decodeURIComponent(email);
  } catch {
    /* keep raw */
  }

  const params = new URLSearchParams({
    doctype: "Sprint Backlogs",
    fields: JSON.stringify([
      "name",
      "subject",
      "status",
      "type",
      "priority",
      "sprint_assign",
      "dev_assignee",
      "current_assignee",
    ]),
    filters: JSON.stringify([["current_assignee", "=", email]]),
    order_by: "modified desc",
    limit_page_length: "50",
  });

  try {
    const res = await erpFetch(
      `${site}/api/method/frappe.client.get_list?${params}`,
      { method: "GET" },
      15_000
    );

    if (!res.ok) {
      const detail = await readErpError(res);
      return {
        ok: false,
        error: detail || `Could not load concerns (${res.status}).`,
      };
    }

    const json = (await res.json()) as { message?: SpbRow[]; exc?: string };
    if (json.exc) {
      return {
        ok: false,
        error: "Could not list Sprint Backlogs (permission or session).",
      };
    }

    const rows = Array.isArray(json.message) ? json.message : [];

    return {
      ok: true,
      data: rows
        .filter((row) => row.name && row.subject)
        .filter((row) => !DONE_STATUSES.has(String(row.status || "").toLowerCase()))
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

async function readErpError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as {
      message?: string | { message?: string };
      exc?: string;
      _server_messages?: string;
    };
    if (typeof json.message === "string" && json.message.trim()) {
      return json.message.trim().slice(0, 180);
    }
    if (json.message && typeof json.message === "object" && json.message.message) {
      return String(json.message.message).trim().slice(0, 180);
    }
    if (json._server_messages) {
      try {
        const arr = JSON.parse(json._server_messages) as string[];
        const first = arr[0]
          ? (JSON.parse(arr[0]) as { message?: string })
          : null;
        if (first?.message) return String(first.message).trim().slice(0, 180);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}
