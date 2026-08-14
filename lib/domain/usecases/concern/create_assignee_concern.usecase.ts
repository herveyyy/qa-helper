import type { Concern, ConcernResult } from "../../../entities/concern.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";
import { getLatestSprintAssign } from "./get_latest_sprint_assign.usecase";

export type CreateConcernInput = {
  subject: string;
  type?: string;
  priority?: string;
  status?: string;
  /** Optional HTML/text description (page URL etc.). */
  description?: string;
};

type SpbDoc = {
  name?: string;
  subject?: string;
  status?: string;
  type?: string;
  priority?: string;
  sprint_assign?: string | null;
  dev_assignee?: string | null;
  current_assignee?: string | null;
};

/** Create an open Sprint Backlogs row for the signed-in user on the latest sprint. */
export async function createAssigneeConcern(
  input: CreateConcernInput,
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<Concern>> {
  const site = normalizeErpBaseUrl(baseUrl);
  if (!site) return { ok: false, error: "Invalid ERP URL." };

  const subject = input.subject.trim();
  if (!subject) return { ok: false, error: "Subject is required." };

  const session = await getExtensionSession(site);
  if (!session.ok) return session;

  const sprint = await getLatestSprintAssign(site);
  if (!sprint.ok) return sprint;

  const email = session.data.email;
  const type = (input.type || "Bugs/Issues").trim() || "Bugs/Issues";
  const priority = (input.priority || "Medium").trim() || "Medium";
  const status = (input.status || "Open").trim() || "Open";
  const description =
    input.description?.trim() ||
    "<p>Created from Faye.</p>";
  const expStartDate = new Date().toISOString().slice(0, 10);

  try {
    const res = await erpFetch(
      `${site}/api/method/frappe.client.insert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: {
            doctype: "Sprint Backlogs",
            subject,
            type,
            status,
            priority,
            module: "RND",
            sprint_assign: sprint.data,
            sprint_points: "1",
            // Default assignees to the signed-in Giya user (QA / creator).
            current_assignee: email,
            dev_assignee: email,
            qa_assignee: email,
            description,
            exp_start_date: expStartDate,
          },
        }),
      },
      20_000
    );

    if (!res.ok) {
      let detail = "";
      try {
        const errJson = (await res.json()) as { message?: string; exc?: string };
        detail = errJson.message || "";
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error: detail || `Could not create SPB (${res.status}).`,
      };
    }

    const json = (await res.json()) as { message?: SpbDoc };
    const doc = json.message;
    if (!doc?.name) {
      return { ok: false, error: "SPB created but name was missing." };
    }

    return {
      ok: true,
      data: {
        name: String(doc.name),
        subject: String(doc.subject || subject),
        status: String(doc.status || status),
        type: String(doc.type || type),
        priority: String(doc.priority || priority),
        sprintAssign: doc.sprint_assign || sprint.data,
        devAssignee: doc.dev_assignee || email,
        currentAssignee: doc.current_assignee || email,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to create SPB."),
    };
  }
}
