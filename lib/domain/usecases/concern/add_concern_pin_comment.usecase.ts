import type { ConcernResult, GiyaPinPayload } from "../../../entities/concern.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { getErpUserProfile } from "../erpnext/get_erp_user_profile.usecase";
import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";
import { buildGiyaPinCommentHtml } from "./giya_pin_markup.usecase";
import {
  isBlankCommentHtml,
  sanitizeCommentHtml,
} from "./sanitize_comment_html.usecase";

/** Post a Giya UI pin as a timeline Comment on a Sprint Backlogs concern. */
export async function addConcernPinComment(
  concernName: string,
  pin: GiyaPinPayload,
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<{ commentName: string }>> {
  const site = normalizeErpBaseUrl(baseUrl);
  if (!site) return { ok: false, error: "Invalid ERP URL." };

  const name = concernName.trim();
  if (!name) return { ok: false, error: "Pick a concern (SPB) first." };

  const html = sanitizeCommentHtml(pin.text);
  if (isBlankCommentHtml(html)) {
    return { ok: false, error: "Write a comment first." };
  }

  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const profile = await getErpUserProfile(site, session.data.sid);
  const commentBy = profile.ok ? profile.data.fullName : session.data.email;
  const commentEmail = profile.ok ? profile.data.email : session.data.email;

  try {
    const res = await erpFetch(`${site}/api/method/frappe.desk.form.utils.add_comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_doctype: "Sprint Backlogs",
        reference_name: name,
        content: buildGiyaPinCommentHtml({ ...pin, text: html }),
        comment_email: commentEmail,
        comment_by: commentBy,
      }),
    });

    const json = (await res.json()) as {
      message?: { name?: string };
      exc?: string;
      exc_type?: string;
    };

    if (!res.ok || json.exc || json.exc_type) {
      if (/csrf/i.test(String(json.exc_type || json.exc || ""))) {
        return {
          ok: false,
          error: "Livro session CSRF expired — reconnect in Faye, then retry.",
        };
      }
      return { ok: false, error: `Could not save comment (${res.status}).` };
    }

    const commentName = json.message?.name;
    if (!commentName) return { ok: false, error: "Comment saved but id missing." };

    return { ok: true, data: { commentName } };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to save comment."),
    };
  }
}
