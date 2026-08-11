import { uploadErpFile } from "../concern-client.ts";
import { ICONS } from "../icons.ts";
import {
  isBlankCommentHtml,
  sanitizeCommentHtml,
} from "../../../lib/domain/usecases/concern/sanitize_comment_html.usecase";

export type RichEditorApi = {
  getHtml: () => string;
  setDisabled: (disabled: boolean) => void;
  clear: () => void;
  focus: () => void;
};

type MountOpts = {
  placeholder?: string;
  /** Attach uploads to this SPB when possible. */
  concernName?: string;
  onStatus?: (message: string) => void;
};

function toolbarButton(
  cmd: string,
  label: string,
  title: string
): string {
  return `<button type="button" data-cmd="${cmd}" class="giya-rte-btn" title="${title}" aria-label="${title}">${label}</button>`;
}

/** Frappe-like HTML comment editor (contenteditable + toolbar + image upload). */
export function mountRichCommentEditor(
  host: HTMLElement,
  opts: MountOpts = {}
): RichEditorApi {
  host.innerHTML = `
    <div class="giya-rte" data-giya-rte>
      <div class="giya-rte-toolbar" role="toolbar" aria-label="Comment formatting">
        ${toolbarButton("bold", "<b>B</b>", "Bold")}
        ${toolbarButton("italic", "<i>I</i>", "Italic")}
        ${toolbarButton("underline", "<u>U</u>", "Underline")}
        ${toolbarButton("strikeThrough", "<s>S</s>", "Strikethrough")}
        <span class="giya-rte-sep" aria-hidden="true"></span>
        ${toolbarButton("insertUnorderedList", "•", "Bullet list")}
        ${toolbarButton("insertOrderedList", "1.", "Numbered list")}
        ${toolbarButton("formatBlock:blockquote", "“", "Quote")}
        <span class="giya-rte-sep" aria-hidden="true"></span>
        ${toolbarButton("createLink", "🔗", "Link")}
        <button type="button" data-cmd="image" class="giya-rte-btn" title="Upload image" aria-label="Upload image">${ICONS.image}</button>
      </div>
      <div
        data-rte-editor
        class="giya-rte-editor"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        data-placeholder="${opts.placeholder || "Comment here…"}"
      ></div>
      <input data-rte-file type="file" accept="image/*" class="hidden" hidden />
    </div>
  `;

  const editor = host.querySelector("[data-rte-editor]") as HTMLDivElement;
  const fileInput = host.querySelector("[data-rte-file]") as HTMLInputElement;
  const toolbar = host.querySelector(".giya-rte-toolbar") as HTMLElement;

  const run = (command: string, value?: string) => {
    editor.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      /* ignore unsupported */
    }
    syncToolbarState();
  };

  const queryActive = (cmd: string): boolean => {
    try {
      if (cmd.startsWith("formatBlock:")) {
        const tag = (cmd.split(":")[1] || "").toLowerCase();
        const block = String(document.queryCommandValue("formatBlock") || "")
          .replace(/[<>]/g, "")
          .toLowerCase();
        return Boolean(tag && block === tag);
      }
      if (cmd === "createLink" || cmd === "image") return false;
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };

  const syncToolbarState = () => {
    for (const btn of toolbar.querySelectorAll<HTMLButtonElement>("[data-cmd]")) {
      const cmd = btn.dataset.cmd || "";
      const on = queryActive(cmd);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  };

  toolbar.addEventListener("mousedown", (event) => {
    // Keep selection in the editor.
    event.preventDefault();
  });

  toolbar.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest(
      "[data-cmd]"
    ) as HTMLElement | null;
    if (!btn) return;
    const cmd = btn.dataset.cmd || "";

    if (cmd === "createLink") {
      const url = window.prompt("Link URL", "https://");
      if (url) run("createLink", url.trim());
      return;
    }

    if (cmd === "image") {
      fileInput.click();
      return;
    }

    if (cmd.startsWith("formatBlock:")) {
      run("formatBlock", cmd.split(":")[1] || "p");
      return;
    }

    run(cmd);
  });

  editor.addEventListener("keyup", syncToolbarState);
  editor.addEventListener("mouseup", syncToolbarState);
  editor.addEventListener("focus", syncToolbarState);
  document.addEventListener("selectionchange", () => {
    if (!host.isConnected) return;
    if (!editor.contains(document.getSelection()?.anchorNode ?? null)) return;
    syncToolbarState();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    void (async () => {
      opts.onStatus?.("Uploading image to Livro…");
      const result = await uploadErpFile({
        file,
        doctype: opts.concernName ? "Sprint Backlogs" : undefined,
        docname: opts.concernName,
        isPrivate: true,
      });
      if (!result.ok) {
        opts.onStatus?.(result.error);
        return;
      }
      editor.focus();
      const safeUrl = result.fileUrl.replaceAll('"', "");
      run(
        "insertHTML",
        `<p><img src="${safeUrl}" alt="${file.name.replaceAll('"', "")}"></p><p><br></p>`
      );
      opts.onStatus?.("Image attached.");
    })();
  });

  editor.addEventListener("paste", (event) => {
    const item = Array.from(event.clipboardData?.items || []).find((i) =>
      i.type.startsWith("image/")
    );
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    event.preventDefault();
    void (async () => {
      opts.onStatus?.("Uploading pasted image…");
      const result = await uploadErpFile({
        file,
        doctype: opts.concernName ? "Sprint Backlogs" : undefined,
        docname: opts.concernName,
        isPrivate: true,
      });
      if (!result.ok) {
        opts.onStatus?.(result.error);
        return;
      }
      const safeUrl = result.fileUrl.replaceAll('"', "");
      run(
        "insertHTML",
        `<p><img src="${safeUrl}" alt="pasted image"></p><p><br></p>`
      );
      opts.onStatus?.("Image attached.");
    })();
  });

  return {
    getHtml: () => sanitizeCommentHtml(editor.innerHTML),
    setDisabled: (disabled) => {
      editor.contentEditable = disabled ? "false" : "true";
      toolbar.querySelectorAll("button").forEach((b) => {
        (b as HTMLButtonElement).disabled = disabled;
      });
    },
    clear: () => {
      editor.innerHTML = "";
      syncToolbarState();
    },
    focus: () => editor.focus(),
  };
}

export function richEditorHasContent(html: string): boolean {
  return !isBlankCommentHtml(html);
}
