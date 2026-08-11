import type { Concern } from "../../../../lib/entities/concern.type";
import { listConcerns } from "../../concern-client.ts";
import { ICONS } from "../../icons.ts";
import { concernNameFromLocation, escapeHtml, loadingMarkup } from "../dom.ts";
import type { WidgetElements } from "../types.ts";

export type ConcernsPanelHost = {
  showPanelVisual: () => void;
  syncDockActive: () => void;
  markConcernsActive: () => void;
  onSelectConcern: (concern: Concern) => void;
  onNewTask: () => void;
};

export async function renderConcernsPanel(
  els: WidgetElements,
  host: ConcernsPanelHost,
  options: { force?: boolean } = {}
): Promise<void> {
  host.markConcernsActive();
  host.syncDockActive();
  els.panelTitle.textContent = "Concerns";
  els.panelBody.innerHTML = loadingMarkup(
    options.force ? "Refreshing concerns…" : "Loading concerns…"
  );
  host.showPanelVisual();

  const result = await listConcerns(Boolean(options.force));
  if (!result.ok) {
    els.panelBody.innerHTML = `
        <div class="space-y-3">
          <p class="text-xs leading-relaxed text-neutral-600">${escapeHtml(result.error)}</p>
          <button
            type="button"
            data-retry-concerns
            class="flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-medium text-neutral-800 transition hover:bg-white"
          >
            ${ICONS.refresh}
            Retry
          </button>
        </div>
      `;
    els.panelBody.querySelector("[data-retry-concerns]")?.addEventListener("click", () => {
      void renderConcernsPanel(els, host, { force: true });
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
            No open concerns yet. Tap <span class="font-medium">+</span> to create a task for QA on this page.
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
              <p class="font-mono text-[10px] font-semibold text-neutral-700">${escapeHtml(c.name)}</p>
              <p class="mt-0.5 line-clamp-2 text-xs font-medium text-neutral-900">${escapeHtml(c.subject)}</p>
              <p class="mt-1 text-[10px] text-neutral-500">${escapeHtml(c.type)} · ${escapeHtml(c.status)}${c.sprintAssign ? ` · ${escapeHtml(c.sprintAssign)}` : ""}</p>
            </button>
          </li>`
          )
          .join("")}
      </ul>`;

  els.panelBody.innerHTML = `
      <div class="mb-3 flex items-center justify-between gap-2">
        <p class="text-xs text-neutral-500">Your open concerns</p>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            data-refresh-concerns
            class="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white/70 text-neutral-800 transition hover:bg-white"
            aria-label="Refresh concerns"
            title="Refresh"
          >
            ${ICONS.refresh}
          </button>
          <button
            type="button"
            data-new-task
            class="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-neutral-900 text-white transition hover:bg-neutral-800"
            aria-label="New task"
            title="New task"
          >
            ${ICONS.plus}
          </button>
        </div>
      </div>
      ${listMarkup}
    `;

  els.panelBody.querySelector("[data-refresh-concerns]")?.addEventListener("click", () => {
    void renderConcernsPanel(els, host, { force: true });
  });

  els.panelBody.querySelector("[data-new-task]")?.addEventListener("click", () => {
    host.onNewTask();
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
