import type {
  ConcernResult,
  GiyaPinComment,
  GiyaPinPayload,
} from "../../../entities/concern.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";
import { parseGiyaPinFromCommentHtml } from "./giya_pin_markup.usecase";

type CommentRow = {
  name?: string;
  content?: string;
  comment_by?: string | null;
  comment_email?: string | null;
  reference_name?: string;
  creation?: string;
};

/** Root thread key: explicit threadId, else the root comment name. */
export function pinThreadId(commentName: string, pin: GiyaPinPayload): string {
  return String(pin.threadId || "").trim() || commentName;
}

export function isPinReply(pin: GiyaPinPayload): boolean {
  return Boolean(String(pin.parentId || "").trim());
}

/**
 * All Giya comments in one discussion on an SPB (by threadId).
 */
export async function listPinThreadComments(
  concernName: string,
  threadId: string,
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<GiyaPinComment[]>> {
  const site = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const name = concernName.trim();
  const tid = threadId.trim();
  if (!name || !tid) return { ok: false, error: "Missing thread." };

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
        ["reference_name", "=", name],
        ["content", "like", "%data-giya-pin%"],
      ]),
      order_by: "creation asc",
      limit_page_length: "100",
    });

    const res = await erpFetch(
      `${site}/api/method/frappe.client.get_list?${params}`,
      { method: "GET" },
      15_000
    );
    if (!res.ok) {
      return { ok: false, error: `Could not load thread (${res.status}).` };
    }

    const json = (await res.json()) as { message?: CommentRow[] };
    const rows = Array.isArray(json.message) ? json.message : [];
    const parsed: GiyaPinComment[] = [];

    for (const row of rows) {
      const pin = parseGiyaPinFromCommentHtml(String(row.content || ""));
      if (!pin) continue;
      const commentName = String(row.name || "");
      if (!commentName) continue;
      parsed.push({
        commentName,
        concernName: name,
        concernSubject: "",
        commentBy: String(row.comment_by || row.comment_email || "Someone"),
        commentEmail: String(row.comment_email || ""),
        creation: String(row.creation || ""),
        pin: { ...pin, threadId: pinThreadId(commentName, pin) },
      });
    }

    const byName = new Map(parsed.map((p) => [p.commentName, p]));
    const inThread = new Set<string>();

    for (const item of parsed) {
      if (item.pin.threadId === tid || item.commentName === tid) {
        inThread.add(item.commentName);
      }
    }

    // Pull in replies that point at thread members (legacy / nested).
    let grew = true;
    while (grew) {
      grew = false;
      for (const item of parsed) {
        if (inThread.has(item.commentName)) continue;
        const parent = String(item.pin.parentId || "");
        if (parent && inThread.has(parent)) {
          inThread.add(item.commentName);
          grew = true;
        }
      }
    }

    const thread = parsed
      .filter((p) => inThread.has(p.commentName))
      .map((p) => ({
        ...p,
        pin: { ...p.pin, threadId: tid },
      }));

    // Ensure root exists even if parse missed siblings.
    if (thread.length === 0 && byName.has(tid)) {
      const root = byName.get(tid)!;
      return { ok: true, data: [{ ...root, pin: { ...root.pin, threadId: tid } }] };
    }

    return { ok: true, data: thread };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to load discussion."),
    };
  }
}
