import type { Concern } from "../../../../lib/entities/concern.type";
import { createConcern, listConcerns } from "../../concern-client.ts";
import { concernNameFromLocation, escapeHtml, loadingMarkup } from "../dom.ts";
import type { WidgetElements } from "../types.ts";

export type ConcernsPanelHost = {
  showPanelVisual: () => void;
  syncDockActive: () => void;
  markConcernsActive: () => void;
  onSelectConcern: (concern: Concern) => void;
};

export async function renderConcernsPanel(
  els: WidgetElements,
  host: ConcernsPanelHost
): Promise<void> {
  host.markConcernsActive();
  host.syncDockActive();
  els.panelTitle.textContent = "Concerns";
  els.panelBody.innerHTML = loadingMarkup("Loading concerns…");
  host.showPanelVisual();

  const result = await listConcerns();
  if (!result.ok) {
    els.panelBody.innerHTML = `
        <div class="space-y-3">
          <p class="text-xs leading-relaxed text-neutral-600">${escapeHtml(result.error)}</p>
          <button
            type="button"
            data-retry-concerns
            class="flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-medium text-neutral-800 transition hover:bg-white"
          >
            Retry
          </button>
        </div>
      `;
    els.panelBody.querySelector("[data-retry-concerns]")?.addEventListener("click", () => {
      void renderConcernsPanel(els, host);
    });
    return;
  }

  const onForm = concernNameFromLocation();
  if (onForm) {
    const match = result.concerns.find((c) => c.name === onForm);
    if (match) {
      host.onSelectConcern(match);
      return;
    }
  }

  const sprintLabel = result.concerns[0]?.sprintAssign || "latest sprint";
  const listMarkup =
    result.concerns.length === 0
      ? `<p class="text-xs leading-relaxed text-neutral-600">
            No open concerns yet. Create one below for QA on this page.
          </p>`
      : `
      <p class="mb-2 text-xs text-neutral-500">
        ${escapeHtml(sprintLabel)} · current assignee. Pick a concern, then pin a UI element.
      </p>
      <ul class="space-y-1.5">
        ${result.concerns
          .map(
            (c) => `
          <li>
            <button
              type="button"
              data-concern="${escapeHtml(c.name)}"
              class="w-full rounded-xl border border-black/8 bg-white/60 px-2.5 py-2 text-left transition hover:bg-white"
            >
              <p class="font-mono text-[10px] font-semibold text-sky-700">${escapeHtml(c.name)}</p>
              <p class="mt-0.5 line-clamp-2 text-xs font-medium text-neutral-900">${escapeHtml(c.subject)}</p>
              <p class="mt-1 text-[10px] text-neutral-500">${escapeHtml(c.type)} · ${escapeHtml(c.status)}${c.sprintAssign ? ` · ${escapeHtml(c.sprintAssign)}` : ""}</p>
            </button>
          </li>`
          )
          .join("")}
      </ul>`;

  els.panelBody.innerHTML = `
      <div class="mb-3 space-y-2 rounded-xl border border-black/8 bg-white/50 p-2.5">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Quick SPB</p>
        <input
          type="text"
          data-create-subject
          placeholder="Subject (e.g. QA: pin misaligned on …)"
          class="w-full rounded-lg border border-black/10 bg-white/70 px-2.5 py-1.5 text-xs text-neutral-900 outline-none ring-neutral-900 placeholder:text-neutral-400 focus:ring-2"
        />
        <div class="flex gap-2">
          <select
            data-create-type
            class="min-w-0 flex-1 rounded-lg border border-black/10 bg-white/70 px-2 py-1.5 text-xs text-neutral-800 outline-none ring-neutral-900 focus:ring-2"
          >
            <option value="Bugs/Issues" selected>Bugs/Issues</option>
            <option value="Feature Request">Feature Request</option>
          </select>
          <button
            type="button"
            data-create-spb
            class="shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600"
          >
            Create
          </button>
        </div>
        <p data-create-status class="min-h-4 text-[10px] text-neutral-500"></p>
      </div>
      ${listMarkup}
    `;

  const subjectInput = els.panelBody.querySelector(
    "[data-create-subject]"
  ) as HTMLInputElement | null;
  const typeSelect = els.panelBody.querySelector(
    "[data-create-type]"
  ) as HTMLSelectElement | null;
  const createBtn = els.panelBody.querySelector(
    "[data-create-spb]"
  ) as HTMLButtonElement | null;
  const createStatus = els.panelBody.querySelector(
    "[data-create-status]"
  ) as HTMLParagraphElement | null;

  const runCreate = () => {
    void (async () => {
      const subject = subjectInput?.value.trim() || "";
      if (!subject) {
        if (createStatus) createStatus.textContent = "Enter a subject.";
        return;
      }
      if (createBtn) createBtn.disabled = true;
      if (createStatus) createStatus.textContent = "Creating…";
      const created = await createConcern({
        subject,
        type: typeSelect?.value || "Bugs/Issues",
        description: `<p>Created from Giya on <a href="${escapeHtml(location.href)}">${escapeHtml(location.href)}</a></p>`,
      });
      if (!created.ok) {
        if (createStatus) createStatus.textContent = created.error;
        if (createBtn) createBtn.disabled = false;
        return;
      }
      host.onSelectConcern(created.concern);
    })();
  };

  createBtn?.addEventListener("click", runCreate);
  subjectInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCreate();
    }
  });

  for (const btn of els.panelBody.querySelectorAll<HTMLButtonElement>("[data-concern]")) {
    btn.addEventListener("click", () => {
      const name = btn.dataset.concern;
      const concern = result.concerns.find((c) => c.name === name) || null;
      if (!concern) return;
      host.onSelectConcern(concern);
    });
  }
}
