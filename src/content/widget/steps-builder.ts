import {
  isBlankCommentHtml,
  sanitizeCommentHtml,
} from "../../../lib/domain/usecases/concern/sanitize_comment_html.usecase";
import { escapeHtml } from "./dom.ts";
import type { RichEditorApi } from "./rich-editor.ts";

export type StepsToReplicateInput = {
  steps: string[];
  expected: string;
  actual: string;
};

function paragraphsFromPlain(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function stepBodyHtml(html: string): string {
  return sanitizeCommentHtml(html);
}

function stepToHtml(html: string, index: number): string {
  const body = stepBodyHtml(html);
  if (isBlankCommentHtml(body)) return "";
  const n = index + 1;
  // Explicit number survives Desk/Tailwind list-style resets.
  if (/^<p(\s|>)/i.test(body)) {
    return body.replace(/^<p([^>]*)>/i, `<p$1><strong>${n}.</strong> `);
  }
  return `<p><strong>${n}.</strong></p>${body}`;
}

/** Build Frappe-safe HTML for a steps-to-replicate block. */
export function buildStepsToReplicateHtml(input: StepsToReplicateInput): string | null {
  const numbered = input.steps
    .map((html, index) => stepToHtml(html, index))
    .filter(Boolean);
  if (!numbered.length) return null;

  const parts: string[] = [
    "<p><strong>Steps to replicate</strong></p>",
    ...numbered,
  ];

  const expected = paragraphsFromPlain(input.expected);
  if (expected) {
    parts.push("<p><strong>Expected</strong></p>", expected);
  }

  const actual = paragraphsFromPlain(input.actual);
  if (actual) {
    parts.push("<p><strong>Actual</strong></p>", actual);
  }

  return parts.join("");
}

export type StepsBuilderApi = {
  close: () => void;
};

export type StepsMountEditor = (
  host: HTMLElement,
  opts: {
    placeholder?: string;
    concernName?: string;
    onStatus?: (message: string) => void;
    initialHtml?: string;
    compact?: boolean;
  }
) => RichEditorApi;

type OpenOpts = {
  onInsert: (html: string) => void;
  onCancel?: () => void;
  concernName?: string;
  onStatus?: (message: string) => void;
  /** Parent mounts RTE so we avoid circular imports / nested Steps buttons. */
  mountEditor: StepsMountEditor;
};

/** Inline guided builder — each step is a rich editor (paste screenshots, upload, capture). */
export function openStepsBuilder(host: HTMLElement, opts: OpenOpts): StepsBuilderApi {
  host.querySelector("[data-str-builder]")?.remove();

  const panel = document.createElement("div");
  panel.className = "giya-str";
  panel.setAttribute("data-str-builder", "");
  panel.innerHTML = `
    <div class="giya-str-head">
      <p class="giya-str-title">Steps to replicate</p>
      <button type="button" data-str-cancel class="giya-str-ghost" aria-label="Cancel">Cancel</button>
    </div>
    <p class="giya-str-hint">Type, paste a screenshot (Ctrl+V), or use the camera / image tools in each step.</p>
    <div data-str-steps class="giya-str-steps"></div>
    <button type="button" data-str-add class="giya-str-add">+ Add step</button>
    <label class="giya-str-label">Expected
      <textarea data-str-expected class="giya-str-area" rows="2" placeholder="What should happen…"></textarea>
    </label>
    <label class="giya-str-label">Actual
      <textarea data-str-actual class="giya-str-area" rows="2" placeholder="What happened…"></textarea>
    </label>
    <p data-str-error class="giya-str-error" hidden></p>
    <div class="giya-str-actions">
      <button type="button" data-str-insert class="giya-str-primary">Insert</button>
    </div>
  `;
  host.appendChild(panel);

  const stepsEl = panel.querySelector("[data-str-steps]") as HTMLElement;
  const errorEl = panel.querySelector("[data-str-error]") as HTMLElement;
  const insertBtn = panel.querySelector("[data-str-insert]") as HTMLButtonElement;

  let drafts: string[] = [""];
  let editors: RichEditorApi[] = [];

  const showError = (message: string | null) => {
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  };

  const syncDraftsFromEditors = () => {
    drafts = editors.map((ed, i) => ed.getHtml() || drafts[i] || "");
  };

  const mountAll = (focusIndex?: number) => {
    editors = [];
    stepsEl.innerHTML = drafts
      .map(
        (_html, index) => `
      <div class="giya-str-card" data-str-row="${index}">
        <div class="giya-str-card-top">
          <span class="giya-str-num">${index + 1}.</span>
          <div class="giya-str-row-actions">
            <button type="button" data-str-up title="Move up" aria-label="Move up" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" data-str-down title="Move down" aria-label="Move down" ${index === drafts.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" data-str-remove title="Remove" aria-label="Remove step" ${drafts.length <= 1 ? "disabled" : ""}>×</button>
          </div>
        </div>
        <div data-str-editor-host></div>
      </div>`
      )
      .join("");

    const hosts = stepsEl.querySelectorAll<HTMLElement>("[data-str-editor-host]");
    hosts.forEach((editorHost, index) => {
      const api = opts.mountEditor(editorHost, {
        placeholder: "Describe this step… paste screenshot here",
        concernName: opts.concernName,
        onStatus: opts.onStatus,
        initialHtml: drafts[index] || "",
        compact: true,
      });
      editors.push(api);
    });

    if (focusIndex != null) {
      queueMicrotask(() => editors[focusIndex]?.focus());
    }
  };

  stepsEl.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest("button");
    if (!btn) return;
    const row = btn.closest("[data-str-row]") as HTMLElement | null;
    if (!row) return;
    const index = Number(row.dataset.strRow || "-1");
    if (Number.isNaN(index) || index < 0) return;

    syncDraftsFromEditors();

    if (btn.hasAttribute("data-str-up") && index > 0) {
      const tmp = drafts[index - 1]!;
      drafts[index - 1] = drafts[index]!;
      drafts[index] = tmp;
      mountAll(index - 1);
      return;
    }
    if (btn.hasAttribute("data-str-down") && index < drafts.length - 1) {
      const tmp = drafts[index + 1]!;
      drafts[index + 1] = drafts[index]!;
      drafts[index] = tmp;
      mountAll(index + 1);
      return;
    }
    if (btn.hasAttribute("data-str-remove") && drafts.length > 1) {
      drafts.splice(index, 1);
      mountAll(Math.min(index, drafts.length - 1));
    }
  });

  panel.querySelector("[data-str-add]")?.addEventListener("click", () => {
    syncDraftsFromEditors();
    drafts.push("");
    mountAll(drafts.length - 1);
  });

  const close = () => {
    editors = [];
    panel.remove();
  };

  panel.querySelector("[data-str-cancel]")?.addEventListener("click", () => {
    close();
    opts.onCancel?.();
  });

  insertBtn.addEventListener("click", () => {
    syncDraftsFromEditors();
    const expected =
      (panel.querySelector("[data-str-expected]") as HTMLTextAreaElement).value || "";
    const actual =
      (panel.querySelector("[data-str-actual]") as HTMLTextAreaElement).value || "";
    const html = buildStepsToReplicateHtml({
      steps: drafts,
      expected,
      actual,
    });
    if (!html) {
      showError("Add text or a screenshot to at least one step.");
      return;
    }
    close();
    opts.onInsert(html);
  });

  mountAll(0);
  return { close };
}
