import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";

/**
 * Resolve the latest Livro sprint label for Sprint Backlogs.sprint_assign
 * (e.g. Sprint-16_R&D / Sprint_14_R&D).
 *
 * Many roles cannot read DocType "Sprint", so we fall back to the most recently
 * modified SPB's sprint_assign.
 */
export async function getLatestSprintAssign(
  baseUrl: string
): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
  const fromSprint = await trySprintDoctype(baseUrl);
  if (fromSprint.ok) return fromSprint;

  const fromSpb = await tryFromSprintBacklogs(baseUrl);
  if (fromSpb.ok) return fromSpb;

  return {
    ok: false,
    error: fromSprint.error || fromSpb.error || "No Sprint found.",
  };
}

async function trySprintDoctype(
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

async function tryFromSprintBacklogs(
  baseUrl: string
): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
  try {
    const res = await erpFetch(
      `${baseUrl}/api/method/frappe.client.get_list`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Sprint Backlogs",
          fields: ["sprint_assign"],
          filters: [["sprint_assign", "!=", ""]],
          order_by: "modified desc",
          limit_page_length: 30,
        }),
      },
      12_000
    );

    if (!res.ok) {
      return {
        ok: false,
        error: `Could not resolve sprint from SPBs (${res.status}).`,
      };
    }

    const json = (await res.json()) as { message?: { sprint_assign?: string }[] };
    const rows = Array.isArray(json.message) ? json.message : [];

    // Prefer R&D sprints when present (skip school/other boards).
    const rnd = rows.find((r) => /r\s*&\s*d/i.test(String(r.sprint_assign || "")));
    const pick = (rnd?.sprint_assign || rows[0]?.sprint_assign || "").trim();
    if (!pick) {
      return { ok: false, error: "No Sprint found on Sprint Backlogs." };
    }

    return { ok: true, data: pick };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Failed to resolve sprint from SPBs."),
    };
  }
}
