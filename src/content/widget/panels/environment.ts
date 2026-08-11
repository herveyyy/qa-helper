import { collectEnvSpecs } from "../../env-specs.ts";
import { escapeHtml } from "../dom.ts";
import type { WidgetElements } from "../types.ts";

export function renderEnvironmentPanel(els: WidgetElements): void {
  els.panelTitle.textContent = "Environment";
  const specs = collectEnvSpecs();
  els.panelBody.innerHTML = `
        <dl class="space-y-2.5">
          ${specs
            .map(
              (s) => `
            <div>
              <dt class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">${escapeHtml(s.label)}</dt>
              <dd class="break-all text-xs leading-snug text-neutral-800">${escapeHtml(s.value)}</dd>
            </div>`
            )
            .join("")}
        </dl>
      `;
}
