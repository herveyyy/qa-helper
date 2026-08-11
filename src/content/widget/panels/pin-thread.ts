import type { GiyaPinComment } from "../../../../lib/entities/concern.type";
import { pinThreadId } from "../../../../lib/domain/usecases/concern/list_pin_thread.usecase";
import { sanitizeCommentHtml } from "../../../../lib/domain/usecases/concern/sanitize_comment_html.usecase";
import {
  addConcernPin,
  getConcernDevops,
  listPinThread,
  resolveConcern,
} from "../../concern-client.ts";
import { ICONS } from "../../icons.ts";
import { avatarFallbackUrl } from "../../../shared/avatar.ts";
import { escapeHtml, loadingMarkup, setButtonBusy } from "../dom.ts";
import {
  mountRichCommentEditor,
  richEditorHasContent,
} from "../rich-editor.ts";
import type { WidgetElements } from "../types.ts";

function shortId(name: string): string {
  return name.length > 10 ? name.slice(-8) : name;
}

function threadItemHtml(item: GiyaPinComment, depth: number): string {
  const body = sanitizeCommentHtml(item.pin.text);
  const indent = Math.min(depth, 3) * 12;
  const reply = Boolean(item.pin.parentId);
  return `
    <article
      data-thread-comment="${escapeHtml(item.commentName)}"
      class="rounded-xl border border-black/8 bg-white/50 px-2.5 py-2 ${reply ? "ml-3 border-l-2 border-l-sky-400/60" : ""}"
      style="margin-left:${indent}px"
    >
      <div class="flex items-start gap-2">
        <img
          src="${escapeHtml(avatarFallbackUrl(item.commentBy || item.commentEmail))}"
          alt=""
          class="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"
          data-thread-avatar
        />
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span class="text-xs font-medium text-neutral-900">${escapeHtml(item.commentBy)}</span>
            <span class="font-mono text-[10px] text-neutral-400" title="${escapeHtml(item.commentName)}">#${escapeHtml(shortId(item.commentName))}</span>
          </div>
          <div class="giya-comment-html text-sm text-neutral-800">${body}</div>
          <button
            type="button"
            data-reply-to="${escapeHtml(item.commentName)}"
            class="text-[11px] font-medium text-sky-700 hover:text-sky-900"
          >Reply</button>
        </div>
      </div>
    </article>
  `;
}

function buildDepthMap(comments: GiyaPinComment[]): Map<string, number> {
  const byName = new Map(comments.map((c) => [c.commentName, c]));
  const depth = new Map<string, number>();

  const of = (name: string, guard = 0): number => {
    if (depth.has(name)) return depth.get(name)!;
    if (guard > 20) return 0;
    const item = byName.get(name);
    if (!item?.pin.parentId || !byName.has(item.pin.parentId)) {
      depth.set(name, 0);
      return 0;
    }
    const d = of(item.pin.parentId, guard + 1) + 1;
    depth.set(name, d);
    return d;
  };

  for (const c of comments) of(c.commentName);
  return depth;
}

export async function renderPinThreadPanel(
  els: WidgetElements,
  root: GiyaPinComment
): Promise<void> {
  const threadId = pinThreadId(root.commentName, root.pin);
  els.panelTitle.textContent = root.concernName;
  els.panelBody.innerHTML = `
    <div class="space-y-3">
      <div class="space-y-2">
        <p class="text-sm font-semibold text-neutral-900">${escapeHtml(root.concernSubject || "Discussion")}</p>
        <div class="flex flex-wrap items-center gap-2">
          <span data-devops-chip class="rounded-full bg-neutral-200/80 px-2 py-0.5 text-[10px] font-medium text-neutral-600">Loading status…</span>
          <button
            type="button"
            data-resolve
            hidden
            class="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-600"
          >Mark as resolve</button>
        </div>
        <p data-resolve-status class="text-[11px] text-neutral-500"></p>
      </div>
      <div data-thread-list class="space-y-2">
        ${loadingMarkup("Loading discussion…")}
      </div>
      <div class="space-y-2 border-t border-black/8 pt-2">
        <p data-reply-hint class="text-[11px] text-neutral-500">Reply in thread</p>
        <div data-reply-editor-host></div>
        <div class="flex items-center justify-between gap-2">
          <p data-reply-status class="text-xs text-neutral-500"></p>
          <button
            type="button"
            data-reply-submit
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-white shadow-md transition hover:bg-sky-600"
            aria-label="Send reply"
          >${ICONS.send}</button>
        </div>
      </div>
    </div>
  `;

  const listEl = els.panelBody.querySelector("[data-thread-list]") as HTMLElement;
  const chip = els.panelBody.querySelector("[data-devops-chip]") as HTMLElement;
  const resolveBtn = els.panelBody.querySelector(
    "[data-resolve]"
  ) as HTMLButtonElement;
  const resolveStatus = els.panelBody.querySelector(
    "[data-resolve-status]"
  ) as HTMLElement;
  const replyHint = els.panelBody.querySelector("[data-reply-hint]") as HTMLElement;
  const replyStatus = els.panelBody.querySelector(
    "[data-reply-status]"
  ) as HTMLElement;
  const submitBtn = els.panelBody.querySelector(
    "[data-reply-submit]"
  ) as HTMLButtonElement;
  const editorHost = els.panelBody.querySelector(
    "[data-reply-editor-host]"
  ) as HTMLElement;

  let replyParentId = root.commentName;
  let comments: GiyaPinComment[] = [root];

  const setReplyTarget = (commentName: string) => {
    replyParentId = commentName;
    replyHint.textContent = `Replying to #${shortId(commentName)}`;
  };

  const paintDevops = (devopsStatus: string, resolved: boolean) => {
    if (resolved) {
      chip.textContent = devopsStatus || "Resolved";
      chip.className =
        "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700";
      resolveBtn.hidden = true;
      resolveStatus.textContent = "";
    } else {
      chip.textContent = "Not resolved";
      chip.className =
        "rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800";
      resolveBtn.hidden = false;
    }
  };

  const paintThread = () => {
    const depths = buildDepthMap(comments);
    if (comments.length === 0) {
      listEl.innerHTML = `<p class="text-xs text-neutral-500">No comments yet.</p>`;
      return;
    }
    listEl.innerHTML = comments
      .map((c) => threadItemHtml(c, depths.get(c.commentName) || 0))
      .join("");

    for (const img of listEl.querySelectorAll<HTMLImageElement>("[data-thread-avatar]")) {
      img.onerror = () => {
        img.onerror = null;
        img.src = avatarFallbackUrl("?");
      };
    }

    listEl.querySelectorAll<HTMLButtonElement>("[data-reply-to]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.replyTo;
        if (id) setReplyTarget(id);
      });
    });
  };

  const reloadThread = async () => {
    const result = await listPinThread(root.concernName, threadId);
    if (!result.ok) {
      listEl.innerHTML = `<p class="text-xs text-rose-600">${escapeHtml(result.error)}</p>`;
      return;
    }
    comments = result.comments.length ? result.comments : [root];
    paintThread();
  };

  const editor = mountRichCommentEditor(editorHost, {
    placeholder: "Write a reply…",
    concernName: root.concernName,
    onStatus: (message) => {
      replyStatus.textContent = message;
    },
  });

  resolveBtn.addEventListener("click", () => {
    void (async () => {
      resolveStatus.textContent = "Updating DevOps status…";
      setButtonBusy(resolveBtn, true, "Mark as resolve");
      const result = await resolveConcern(root.concernName);
      setButtonBusy(resolveBtn, false, "Mark as resolve");
      if (!result.ok) {
        resolveStatus.textContent = result.error;
        return;
      }
      paintDevops(result.devopsStatus, result.resolved);
      resolveStatus.textContent = "Set to For Staging Update.";
    })();
  });

  submitBtn.addEventListener("click", () => {
    void (async () => {
      const html = editor.getHtml();
      if (!richEditorHasContent(html)) {
        replyStatus.textContent = "Write a reply first.";
        return;
      }
      replyStatus.innerHTML = loadingMarkup("Sending…");
      setButtonBusy(submitBtn, true, ICONS.send);
      editor.setDisabled(true);

      const result = await addConcernPin(root.concernName, {
        v: 1,
        href: root.pin.href,
        selector: root.pin.selector,
        label: root.pin.label,
        tagName: root.pin.tagName,
        text: html,
        threadId,
        parentId: replyParentId,
      });

      setButtonBusy(submitBtn, false, ICONS.send);
      editor.setDisabled(false);

      if (!result.ok) {
        replyStatus.textContent = result.error;
        return;
      }

      editor.clear();
      replyStatus.textContent = "Sent.";
      setReplyTarget(root.commentName);
      await reloadThread();
    })();
  });

  const devops = await getConcernDevops(root.concernName);
  if (devops.ok) paintDevops(devops.devopsStatus, devops.resolved);
  else {
    chip.textContent = "Status unavailable";
    resolveStatus.textContent = devops.error;
  }

  await reloadThread();
  editor.focus();
}
