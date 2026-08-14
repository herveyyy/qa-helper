import { FALLBACK_SPB_STATUSES } from "../../../lib/domain/usecases/concern/update_concern_fields.usecase";
import {
  getConcernFields,
  getSpbStatusOptions,
  searchErpUsers,
  setConcernField,
} from "../concern-client.ts";
import { escapeHtml } from "./dom.ts";

type MountOpts = {
  concernName: string;
  initialStatus?: string;
  initialAssignee?: string;
};

function statusOptionsHtml(options: string[], selected: string): string {
  const values = Array.from(new Set(options.filter(Boolean)));
  if (selected && !values.includes(selected)) values.unshift(selected);
  return values
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`
    )
    .join("");
}

/** Status select + searchable current-assignee, saved straight to the SPB. */
export function mountConcernFields(host: HTMLElement, opts: MountOpts): void {
  host.innerHTML = `
    <div class="giya-fields">
      <div class="giya-fields-row">
        <label class="giya-field">
          <span class="giya-field-label">Status</span>
          <select data-concern-status class="giya-field-control">
            ${statusOptionsHtml(FALLBACK_SPB_STATUSES, opts.initialStatus || "Open")}
          </select>
        </label>
        <div class="giya-field giya-assignee">
          <span class="giya-field-label">Current assignee</span>
          <input
            type="search"
            data-assignee-input
            autocomplete="off"
            spellcheck="false"
            placeholder="Search user…"
            class="giya-field-control"
            value="${escapeHtml(opts.initialAssignee || "")}"
          />
          <div data-assignee-list class="giya-assignee-list" hidden></div>
        </div>
      </div>
      <p data-fields-status class="giya-field-status"></p>
    </div>
  `;

  const statusSelect = host.querySelector(
    "[data-concern-status]"
  ) as HTMLSelectElement;
  const input = host.querySelector("[data-assignee-input]") as HTMLInputElement;
  const list = host.querySelector("[data-assignee-list]") as HTMLElement;
  const statusEl = host.querySelector("[data-fields-status]") as HTMLElement;

  const setMsg = (message: string) => {
    statusEl.textContent = message;
  };

  const hideList = () => {
    list.hidden = true;
    list.innerHTML = "";
  };

  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const runSearch = (query: string) => {
    const id = ++seq;
    void (async () => {
      const result = await searchErpUsers(query);
      if (id !== seq) return;
      if (!result.ok) {
        setMsg(result.error);
        hideList();
        return;
      }
      if (!result.users.length) {
        list.innerHTML = `<p class="giya-assignee-empty">No users found</p>`;
        list.hidden = false;
        return;
      }
      list.innerHTML = result.users
        .map(
          (u) => `
        <button type="button" class="giya-assignee-item" data-email="${escapeHtml(u.email)}" data-name="${escapeHtml(u.fullName)}">
          <span class="giya-assignee-name">${escapeHtml(u.fullName)}</span>
          <span class="giya-assignee-email">${escapeHtml(u.email)}</span>
        </button>`
        )
        .join("");
      list.hidden = false;
    })();
  };

  input.addEventListener("focus", () => runSearch(input.value.trim()));
  input.addEventListener("input", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => runSearch(input.value.trim()), 220);
  });
  input.addEventListener("blur", () => setTimeout(hideList, 150));

  list.addEventListener("mousedown", (event) => event.preventDefault());
  list.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest(
      "[data-email]"
    ) as HTMLElement | null;
    const email = btn?.dataset.email || "";
    if (!email) return;
    const fullName = btn?.dataset.name || email;
    input.value = email;
    hideList();
    void (async () => {
      setMsg("Updating assignee…");
      const result = await setConcernField(
        opts.concernName,
        "current_assignee",
        email
      );
      setMsg(result.ok ? `Assignee → ${fullName}` : result.error);
    })();
  });

  statusSelect.addEventListener("change", () => {
    const value = statusSelect.value.trim();
    if (!value) return;
    void (async () => {
      setMsg("Updating status…");
      const result = await setConcernField(opts.concernName, "status", value);
      setMsg(result.ok ? `Status → ${value}` : result.error);
    })();
  });

  void (async () => {
    const [fields, options] = await Promise.all([
      getConcernFields(opts.concernName),
      getSpbStatusOptions(),
    ]);
    const current = fields.ok ? fields.status : opts.initialStatus || "Open";
    if (options.ok) {
      statusSelect.innerHTML = statusOptionsHtml(options.options, current);
    }
    statusSelect.value = current;
    if (fields.ok) input.value = fields.currentAssignee || "";
    else setMsg(fields.error);
  })();
}
