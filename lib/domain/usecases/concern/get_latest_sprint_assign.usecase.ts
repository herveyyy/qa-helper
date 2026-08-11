import { ensureErpSidCookie } from "../auth/ensure_erp_sid_cookie.usecase";
import { getGiyaConnection } from "../auth/giya_erp_connection.usecase";
import { clearSessionCache } from "../auth/get_extension_session.usecase";
import { erpErrorMessage, erpFetch } from "../erpnext/erp_fetch.usecase";

/**
 * Resolve latest sprint_assign for creating SPBs.
 * Uses Sprint Backlogs only — DocType "Sprint" is often denied for QA roles.
 */
export async function getLatestSprintAssign(
  baseUrl: string
): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
  const fromSpb = await tryFromSprintBacklogs(baseUrl);
  if (fromSpb.ok) return fromSpb;

  return {
    ok: false,
    error:
      fromSpb.error ||
      "Could not resolve sprint from Sprint Backlogs. Reconnect Livro and retry.",
  };
}

async function recoverSidCookie(baseUrl: string): Promise<void> {
  clearSessionCache();
  const connection = await getGiyaConnection();
  if (!connection?.sid) return;
  await ensureErpSidCookie(baseUrl, connection.sid, {
    userId: connection.email,
    fullName: connection.fullName,
  });
}

async function tryFromSprintBacklogs(
  baseUrl: string
): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
  const attempts: unknown[][] = [
    [["sprint_assign", "is", "set"]],
    [["sprint_assign", "!=", ""]],
    [],
  ];

  let lastError = "Could not read Sprint Backlogs for sprint.";
  let recovered = false;

  for (const filters of attempts) {
    let result = await fetchSpbSprintAssigns(baseUrl, filters);
    if (
      !result.ok &&
      !recovered &&
      result.error.toLowerCase().includes("failed to fetch")
    ) {
      await recoverSidCookie(baseUrl);
      recovered = true;
      result = await fetchSpbSprintAssigns(baseUrl, filters);
    }
    if (result.ok) {
      const pick = pickLatestRndSprint(result.data);
      if (pick) return { ok: true, data: pick };
      lastError = "No sprint_assign values on Sprint Backlogs.";
      continue;
    }
    lastError = result.error;
    if (result.error.toLowerCase().includes("failed to fetch")) break;
  }

  return { ok: false, error: lastError };
}

async function fetchSpbSprintAssigns(
  baseUrl: string,
  filters: unknown[]
): Promise<{ ok: true; data: string[] } | { ok: false; error: string }> {
  try {
    const body: Record<string, unknown> = {
      doctype: "Sprint Backlogs",
      fields: ["sprint_assign", "modified"],
      order_by: "modified desc",
      limit_page_length: 50,
    };
    if (filters.length) body.filters = filters;

    const res = await erpFetch(
      `${baseUrl}/api/method/frappe.client.get_list`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      15_000
    );

    if (!res.ok) {
      return { ok: false, error: await erpHttpError(res, "Sprint Backlogs") };
    }

    const json = (await res.json()) as {
      message?: { sprint_assign?: string | null }[] | null;
      exc?: string;
    };

    if (json.exc) {
      return {
        ok: false,
        error: "Could not list Sprint Backlogs (permission or session).",
      };
    }

    const rows = Array.isArray(json.message) ? json.message : [];
    const values = rows
      .map((r) => String(r.sprint_assign || "").trim())
      .filter(Boolean);

    return { ok: true, data: values };
  } catch (error) {
    return {
      ok: false,
      error: erpErrorMessage(error, "Sprint Backlogs lookup failed."),
    };
  }
}

function pickLatestRndSprint(values: string[]): string | null {
  if (!values.length) return null;

  const rnd = values.filter((v) => /r\s*&\s*d/i.test(v));
  const pool = rnd.length ? rnd : values;

  let best: string | null = null;
  let bestNum = -1;
  for (const label of pool) {
    const m = label.match(/(\d+)/);
    const n = m ? Number(m[1]) : -1;
    if (n > bestNum) {
      bestNum = n;
      best = label;
    }
  }

  return best || pool[0] || null;
}

async function erpHttpError(res: Response, label: string): Promise<string> {
  let detail = "";
  try {
    const json = (await res.json()) as {
      message?: string | { message?: string };
      _server_messages?: string;
    };
    if (typeof json.message === "string") detail = json.message;
    else if (json.message && typeof json.message === "object") {
      detail = String(json.message.message || "");
    }
    if (!detail && json._server_messages) {
      try {
        const arr = JSON.parse(json._server_messages) as string[];
        const first = arr[0]
          ? (JSON.parse(arr[0]) as { message?: string })
          : null;
        detail = first?.message || "";
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return detail || `Could not load ${label} (${res.status}).`;
}
