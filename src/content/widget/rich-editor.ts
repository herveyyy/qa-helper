import { uploadErpFile } from "../concern-client.ts";
import { ICONS } from "../icons.ts";
import {
  isBlankCommentHtml,
  sanitizeCommentHtml,
} from "../../../lib/domain/usecases/concern/sanitize_comment_html.usecase";
import { hydrateErpImages } from "./image-preview.ts";
import {
  capturePageScreenshot,
  openScreenshotAnnotator,
} from "./screenshot-annotate.ts";
import { openStepsBuilder } from "./steps-builder.ts";

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
  /** Seed content (used by Steps builder). */
  initialHtml?: string;
  /** Smaller editor for nested step cards. */
  compact?: boolean;
  /** Show Steps-to-replicate toolbar button (off inside the Steps builder). */
  enableSteps?: boolean;
};

function toolbarButton(cmd: string, label: string, title: string): string {
  return `<button type="button" data-cmd="${cmd}" class="giya-rte-btn" title="${title}" aria-label="${title}">${label}</button>`;
}

function exportEditorHtml(editor: HTMLElement): string {
  const clone = editor.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".giya-img-resize").forEach((node) => node.remove());
  clone.querySelectorAll("img").forEach((img) => {
    const erp = img.getAttribute("data-erp-src");
    if (erp) img.setAttribute("src", erp);
    img.removeAttribute("data-erp-src");
    img.classList.remove("giya-img-selected", "giya-img-loading", "giya-img-broken");
    const width = img.style.width || img.getAttribute("width");
    if (width) {
      const px = String(width).replace(/px$/i, "");
      if (/^\d+$/.test(px)) {
        img.setAttribute("width", px);
        img.style.width = `${px}px`;
        img.style.maxWidth = "100%";
        img.style.height = "auto";
      }
    }
  });
  return sanitizeCommentHtml(clone.innerHTML);
}

/** Frappe-like HTML comment editor (contenteditable + toolbar + image upload). */
export function mountRichCommentEditor(
  host: HTMLElement,
  opts: MountOpts = {}
): RichEditorApi {
  const enableSteps = opts.enableSteps !== false;
  const stepsBtn = enableSteps
    ? `<button type="button" data-cmd="steps" class="giya-rte-btn" title="Steps to replicate" aria-label="Steps to replicate">${ICONS.steps}</button>`
    : "";

  host.innerHTML = `
    <div class="giya-rte${opts.compact ? " giya-rte-compact" : ""}" data-giya-rte>
      <div class="giya-rte-toolbar" role="toolbar" aria-label="Comment formatting">
        ${toolbarButton("bold", "<b>B</b>", "Bold")}
        ${toolbarButton("italic", "<i>I</i>", "Italic")}
        ${toolbarButton("underline", "<u>U</u>", "Underline")}
        ${toolbarButton("strikeThrough", "<s>S</s>", "Strikethrough")}
        <span class="giya-rte-sep" aria-hidden="true"></span>
        ${toolbarButton("insertUnorderedList", "•", "Bullet list")}
        ${toolbarButton("insertOrderedList", "1.", "Numbered list")}
        ${toolbarButton("formatBlock:blockquote", "“", "Quote")}
        ${stepsBtn}
        <span class="giya-rte-sep" aria-hidden="true"></span>
        ${toolbarButton("createLink", "🔗", "Link")}
        <button type="button" data-cmd="image" class="giya-rte-btn" title="Upload image" aria-label="Upload image">${ICONS.image}</button>
        <button type="button" data-cmd="capture" class="giya-rte-btn" title="Screenshot &amp; annotate" aria-label="Screenshot and annotate">${ICONS.capture}</button>
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

  const rte = host.querySelector("[data-giya-rte]") as HTMLElement;
  const editor = host.querySelector("[data-rte-editor]") as HTMLDivElement;
  if (opts.initialHtml) {
    editor.innerHTML = sanitizeCommentHtml(opts.initialHtml);
    void hydrateErpImages(editor);
  }
  const fileInput = host.querySelector("[data-rte-file]") as HTMLInputElement;
  const toolbar = host.querySelector(".giya-rte-toolbar") as HTMLElement;
  let selectedImg: HTMLImageElement | null = null;
  let stepsBuilderOpen = false;

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
      if (
        cmd === "createLink" ||
        cmd === "image" ||
        cmd === "steps" ||
        cmd === "capture"
      ) {
        return false;
      }
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

  const clearImageSelection = () => {
    editor.querySelectorAll(".giya-img-selected").forEach((el) => {
      el.classList.remove("giya-img-selected");
    });
    editor.querySelectorAll(".giya-img-resize").forEach((el) => el.remove());
    selectedImg = null;
  };

  const selectImage = (img: HTMLImageElement) => {
    clearImageSelection();
    selectedImg = img;
    img.classList.add("giya-img-selected");

    const handle = document.createElement("span");
    handle.className = "giya-img-resize";
    handle.contentEditable = "false";
    handle.title = "Drag to resize";
    img.insertAdjacentElement("afterend", handle);

    const onMove = (event: PointerEvent) => {
      if (!selectedImg) return;
      const rect = selectedImg.getBoundingClientRect();
      const next = Math.max(80, Math.min(editor.clientWidth - 8, event.clientX - rect.left));
      selectedImg.style.width = `${Math.round(next)}px`;
      selectedImg.style.height = "auto";
      selectedImg.setAttribute("width", String(Math.round(next)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  };

  const insertImageFromFile = async (file: File, statusText: string) => {
    opts.onStatus?.(statusText);
    const localUrl = URL.createObjectURL(file);
    const alt = file.name.replaceAll('"', "");
    const before = new Set(editor.querySelectorAll("img"));
    run(
      "insertHTML",
      `<p><img src="${localUrl}" alt="${alt}" width="280" style="width:280px;max-width:100%;height:auto"></p><p><br></p>`
    );
    const img =
      Array.from(editor.querySelectorAll("img")).find((node) => !before.has(node)) ||
      null;
    if (img) selectImage(img);

    // Public so Desk + Faye can preview without private-file cookie issues.
    const result = await uploadErpFile({
      file,
      doctype: opts.concernName ? "Sprint Backlogs" : undefined,
      docname: opts.concernName,
      isPrivate: false,
    });
    if (!result.ok) {
      opts.onStatus?.(result.error);
      return;
    }

    const erpUrl = result.fileUrl.replaceAll('"', "");
    if (img?.isConnected) {
      img.setAttribute("data-erp-src", erpUrl);
      void hydrateErpImages(editor);
    }
    opts.onStatus?.("Image attached — click it, drag the corner to resize.");
  };

  const openSteps = () => {
    if (stepsBuilderOpen) return;
    stepsBuilderOpen = true;
    openStepsBuilder(rte, {
      concernName: opts.concernName,
      onStatus: opts.onStatus,
      mountEditor: (editorHost, editorOpts) =>
        mountRichCommentEditor(editorHost, {
          ...editorOpts,
          enableSteps: false,
        }),
      onInsert: (html) => {
        stepsBuilderOpen = false;
        run("insertHTML", `${html}<p><br></p>`);
        opts.onStatus?.("Steps inserted.");
        void hydrateErpImages(editor);
      },
      onCancel: () => {
        stepsBuilderOpen = false;
      },
    });
  };

  const openCapture = async () => {
    opts.onStatus?.("Capturing page…");
    const shot = await capturePageScreenshot();
    if (!shot.ok) {
      opts.onStatus?.(shot.error);
      return;
    }

    const root = host.getRootNode();
    if (!(root instanceof ShadowRoot)) {
      opts.onStatus?.("Could not open annotator.");
      return;
    }

    opts.onStatus?.("Draw on the screenshot, then Insert.");
    const annotated = await openScreenshotAnnotator(root, shot.dataUrl);
    if (!annotated.ok) {
      if ("cancelled" in annotated && annotated.cancelled) {
        opts.onStatus?.("Screenshot cancelled.");
        return;
      }
      opts.onStatus?.("error" in annotated ? annotated.error : "Screenshot failed.");
      return;
    }

    await insertImageFromFile(annotated.file, "Uploading screenshot to Livro…");
  };

  toolbar.addEventListener("mousedown", (event) => {
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

    if (cmd === "steps") {
      openSteps();
      return;
    }

    if (cmd === "capture") {
      void openCapture();
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

  editor.addEventListener("click", (event) => {
    const img = (event.target as HTMLElement | null)?.closest("img");
    if (img && editor.contains(img)) {
      event.preventDefault();
      selectImage(img as HTMLImageElement);
      return;
    }
    if (!(event.target as HTMLElement | null)?.closest(".giya-img-resize")) {
      clearImageSelection();
    }
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    void insertImageFromFile(file, "Uploading image to Livro…");
  });

  editor.addEventListener("paste", (event) => {
    const item = Array.from(event.clipboardData?.items || []).find((i) =>
      i.type.startsWith("image/")
    );
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    event.preventDefault();
    void insertImageFromFile(file, "Uploading pasted image…");
  });

  return {
    getHtml: () => exportEditorHtml(editor),
    setDisabled: (disabled) => {
      editor.contentEditable = disabled ? "false" : "true";
      toolbar.querySelectorAll("button").forEach((b) => {
        (b as HTMLButtonElement).disabled = disabled;
      });
    },
    clear: () => {
      clearImageSelection();
      editor.innerHTML = "";
      host.querySelector("[data-str-builder]")?.remove();
      stepsBuilderOpen = false;
      syncToolbarState();
    },
    focus: () => editor.focus(),
  };
}

export function richEditorHasContent(html: string): boolean {
  return !isBlankCommentHtml(html);
}
