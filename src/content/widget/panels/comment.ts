import type { Concern } from "../../../../lib/entities/concern.type";
import { addConcernPin } from "../../concern-client.ts";
import type { PickedElement } from "../../element-picker.ts";
import { collectEnvSpecs } from "../../env-specs.ts";
import { ICONS } from "../../icons.ts";
import { escapeHtml, loadingMarkup, setButtonBusy } from "../dom.ts";
import {
  mountRichCommentEditor,
  richEditorHasContent,
} from "../rich-editor.ts";
import type { WidgetElements } from "../types.ts";

export type CommentPanelHost = {
  renderDraftPin: (rect: DOMRect) => void;
  clearDraftPin: () => void;
  onChangeConcern: () => void;
  onRetarget: () => void;
  onSaved: () => Promise<void>;
};

export function renderCommentPanel(
  els: WidgetElements,
  concern: Concern,
  picked: PickedElement,
  host: CommentPanelHost
): void {
  const rect = picked.element.getBoundingClientRect();
  host.renderDraftPin(rect);

  els.panelTitle.textContent = "Comment";
  els.panelBody.innerHTML = `
      <div class="space-y-3">
        <div class="rounded-xl border border-black/8 bg-white/50 px-2.5 py-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Concern</p>
          <p class="mt-0.5 font-mono text-[10px] font-semibold text-neutral-700">${escapeHtml(concern.name)}</p>
          <p class="mt-0.5 line-clamp-2 text-xs font-medium text-neutral-900">${escapeHtml(concern.subject)}</p>
          <button type="button" data-change-concern class="mt-2 text-xs font-medium text-neutral-700 underline-offset-2 hover:underline">
            Change concern
          </button>
        </div>
        <div class="rounded-xl border border-black/8 bg-white/50 px-2.5 py-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Pinned to</p>
          <p class="mt-0.5 break-all text-xs font-medium text-neutral-900">${escapeHtml(picked.label)}</p>
          <button type="button" data-retarget class="mt-2 text-xs font-medium text-neutral-700 underline-offset-2 hover:underline">
            Change element
          </button>
        </div>
        <div data-comment-editor-host></div>
        <div class="flex items-center justify-between gap-2">
          <p data-comment-status class="text-xs text-neutral-500">HTML comment → Livro SPB (images upload like Desk).</p>
          <button
            type="button"
            data-comment-submit
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md transition hover:bg-neutral-800"
            aria-label="Send comment"
          >
            ${ICONS.send}
          </button>
        </div>
      </div>
    `;

  const submitBtn = els.panelBody.querySelector(
    "[data-comment-submit]"
  ) as HTMLButtonElement | null;
  const status = els.panelBody.querySelector("[data-comment-status]");
  const editorHost = els.panelBody.querySelector(
    "[data-comment-editor-host]"
  ) as HTMLElement | null;

  const editor = editorHost
    ? mountRichCommentEditor(editorHost, {
        placeholder: "Write a comment…",
        concernName: concern.name,
        onStatus: (message) => {
          if (status) status.textContent = message;
        },
      })
    : null;

  els.panelBody.querySelector("[data-change-concern]")?.addEventListener("click", () => {
    host.onChangeConcern();
  });

  els.panelBody.querySelector("[data-retarget]")?.addEventListener("click", () => {
    host.onRetarget();
  });

  const sendIdle = ICONS.send;
  submitBtn?.addEventListener("click", () => {
    void (async () => {
      const html = editor?.getHtml() ?? "";
      if (!richEditorHasContent(html)) {
        if (status) status.textContent = "Write something first.";
        return;
      }
      if (status) status.innerHTML = loadingMarkup("Saving to Livro…");
      setButtonBusy(submitBtn, true, sendIdle);
      editor?.setDisabled(true);

      const result = await addConcernPin(concern.name, {
        v: 1,
        href: location.href,
        selector: picked.selector,
        label: picked.label,
        tagName: picked.tagName,
        text: html,
        threadId: crypto.randomUUID(),
        envSpecs: collectEnvSpecs(),
      });

      if (!result.ok) {
        setButtonBusy(submitBtn, false, sendIdle);
        editor?.setDisabled(false);
        if (status) status.textContent = result.error;
        return;
      }

      editor?.clear();
      if (status) status.innerHTML = loadingMarkup("Refreshing pins…");
      await host.onSaved();
    })();
  });

  editor?.focus();
}
