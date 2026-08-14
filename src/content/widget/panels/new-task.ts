import type { Concern } from "../../../../lib/entities/concern.type";
import { FALLBACK_SPB_STATUSES } from "../../../../lib/domain/usecases/concern/update_concern_fields.usecase";
import { createConcern, getSpbStatusOptions } from "../../concern-client.ts";
import { ICONS } from "../../icons.ts";
import { escapeHtml, loadingMarkup, setButtonBusy } from "../dom.ts";
import type { WidgetElements } from "../types.ts";

export type NewTaskPanelHost = {
  showPanelVisual: () => void;
  focusPanelField: (selector: string) => void;
  onCreated: (concern: Concern) => void;
};

export function renderNewTaskPanel(
  els: WidgetElements,
  host: NewTaskPanelHost
): void {
  els.panelTitle.textContent = "New task";
  els.panelBody.innerHTML = `
      <div class="space-y-3">
        <p class="text-xs leading-relaxed text-neutral-600">
          Creates a Sprint Backlog on the latest R&amp;D sprint, assigned to you.
        </p>
        <input
          type="text"
          data-create-subject
          placeholder="Subject (e.g. QA: pin misaligned on …)"
          class="w-full rounded-lg border border-black/10 bg-white/70 px-2.5 py-1.5 text-xs text-neutral-900 outline-none ring-neutral-900 placeholder:text-neutral-400 focus:ring-2"
        />
        <select
          data-create-type
          class="w-full rounded-lg border border-black/10 bg-white/70 px-2 py-1.5 text-xs text-neutral-800 outline-none ring-neutral-900 focus:ring-2"
        >
          <option value="Bugs/Issues" selected>Bugs/Issues</option>
          <option value="Feature Request">Feature Request</option>
        </select>
        <select
          data-create-spb-status
          class="w-full rounded-lg border border-black/10 bg-white/70 px-2 py-1.5 text-xs text-neutral-800 outline-none ring-neutral-900 focus:ring-2"
        >
          ${FALLBACK_SPB_STATUSES.map(
            (value) =>
              `<option value="${escapeHtml(value)}" ${value === "Open" ? "selected" : ""}>${escapeHtml(value)}</option>`
          ).join("")}
        </select>
        <button
          type="button"
          data-create-spb
          class="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-neutral-800"
        >
          ${ICONS.plus}
          Create
        </button>
        <p data-create-status class="min-h-4 text-[10px] text-neutral-500"></p>
      </div>
    `;

  host.showPanelVisual();
  host.focusPanelField("[data-create-subject]");

  const subjectInput = els.panelBody.querySelector(
    "[data-create-subject]"
  ) as HTMLInputElement | null;
  const typeSelect = els.panelBody.querySelector(
    "[data-create-type]"
  ) as HTMLSelectElement | null;
  const statusSelect = els.panelBody.querySelector(
    "[data-create-spb-status]"
  ) as HTMLSelectElement | null;
  const createBtn = els.panelBody.querySelector(
    "[data-create-spb]"
  ) as HTMLButtonElement | null;
  const createStatus = els.panelBody.querySelector(
    "[data-create-status]"
  ) as HTMLParagraphElement | null;

  void getSpbStatusOptions().then((result) => {
    if (!result.ok || !statusSelect) return;
    const current = statusSelect.value || "Open";
    statusSelect.innerHTML = result.options
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(value)}</option>`
      )
      .join("");
  });

  const idleHtml = `${ICONS.plus} Create`;

  const runCreate = () => {
    void (async () => {
      const subject = subjectInput?.value.trim() || "";
      if (!subject) {
        if (createStatus) createStatus.textContent = "Enter a subject.";
        return;
      }
      if (createStatus) createStatus.innerHTML = loadingMarkup("Creating…");
      setButtonBusy(createBtn, true, idleHtml);
      const created = await createConcern({
        subject,
        type: typeSelect?.value || "Bugs/Issues",
        status: statusSelect?.value || "Open",
        description: `<p>Created from Faye on <a href="${escapeHtml(location.href)}">${escapeHtml(location.href)}</a></p>`,
      });
      if (!created.ok) {
        if (createStatus) createStatus.textContent = created.error;
        setButtonBusy(createBtn, false, idleHtml);
        return;
      }
      host.onCreated(created.concern);
    })();
  };

  createBtn?.addEventListener("click", runCreate);
  subjectInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCreate();
    }
  });
}
