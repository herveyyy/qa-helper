import type { ConcernResult, GiyaPinComment } from "../../../entities/concern.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";
import {
  hrefMatchesPin,
  parseGiyaPinFromCommentHtml,
} from "./giya_pin_markup.usecase";
import { listAssigneeConcerns } from "./list_assignee_concerns.usecase";

type CommentRow = {
  name?: string;
  content?: string;
  comment_by?: string | null;
  comment_email?: string | null;
  reference_name?: string;
  creation?: string;
};

/**
 * Giya pins on this page for concerns where the user is an assignee.
 * Non-assignees never see these pins (ERP list is already scoped).
 *
 * Prefer passing `concernNames` from the SW concerns cache so we don't
 * cold-fetch Sprint Backlogs twice.
 */
export async function listPagePinComments(
  pageHref: string,
  baseUrl: string = ERP_BASE_URL,
  options: { concernNames?: string[]; concernSubjects?: Map<string, string> } = {}
): Promise<ConcernResult<GiyaPinComment[]>> {
  const site = normalizeErpBaseUrl(baseUrl);
  if (!site) return { ok: false, error: "Invalid ERP URL." };

  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  let names = options.concernNames ?? [];
  let byName = options.concernSubjects ?? new Map<string, string>();

  if (names.length === 0) {
    const concerns = await listAssigneeConcerns(site);
    if (!concerns.ok) return concerns;
    if (concerns.data.length === 0) return { ok: true, data: [] };
    names = concerns.data.map((c) => c.name);
    byName = new Map(concerns.data.map((c) => [c.name, c.subject]));
  }

  if (names.length === 0) return { ok: true, data: [] };

  try {
    const params = new URLSearchParams({
      doctype: "Comment",
      fields: JSON.stringify([
        "name",
        "content",
        "comment_by",
        "comment_email",
        "reference_name",
        "creation",
      ]),
      filters: JSON.stringify([
        ["reference_doctype", "=", "Sprint Backlogs"],
        ["comment_type", "=", "Comment"],
        ["reference_name", "in", names],
        ["content", "like", "%data-giya-pin%"],
      ]),
      order_by: "creation desc",
      limit_page_length: "100",
    });

    const res = await erpFetch(
      `${site}/api/method/frappe.client.get_list?${params}`,
      { method: "GET" },
      15_000
    );

    if (!res.ok) {
      return { ok: false, error: `Could not load comments (${res.status}).` };
    }

    const json = (await res.json()) as { message?: CommentRow[] };
    const rows = Array.isArray(json.message) ? json.message : [];
    const pins: GiyaPinComment[] = [];

    for (const row of rows) {
      const pin = parseGiyaPinFromCommentHtml(String(row.content || ""));
      if (!pin || !hrefMatchesPin(pageHref, pin.href)) continue;

      const concernName = String(row.reference_name || "");
      const concernSubject = byName.get(concernName);
      if (!concernSubject) continue;

      pins.push({
        commentName: String(row.name || ""),
        concernName,
        concernSubject,
        commentBy: String(row.comment_by || row.comment_email || "Someone"),
        commentEmail: String(row.comment_email || ""),
        creation: String(row.creation || ""),
        pin,
      });
    }

    return { ok: true, data: pins };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to load page pins."),
    };
  }
}
