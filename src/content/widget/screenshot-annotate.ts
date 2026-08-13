import { HOST_ID } from "../constants.ts";
import { captureVisibleTab } from "../concern-client.ts";

type Tool = "pen" | "rect" | "arrow" | "highlight";

type Point = { x: number; y: number };

type Stroke =
  | { kind: "pen"; points: Point[]; color: string; width: number }
  | { kind: "rect"; a: Point; b: Point; color: string; width: number }
  | { kind: "arrow"; a: Point; b: Point; color: string; width: number }
  | { kind: "highlight"; a: Point; b: Point };

export type AnnotateResult =
  | { ok: true; file: File }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Hide Faye UI, capture the tab, restore UI. */
export async function capturePageScreenshot(): Promise<
  { ok: true; dataUrl: string } | { ok: false; error: string }
> {
  const host = document.getElementById(HOST_ID) as HTMLElement | null;
  const prev = host?.style.visibility ?? "";
  if (host) host.style.visibility = "hidden";
  try {
    await sleep(60);
    return await captureVisibleTab();
  } finally {
    if (host) host.style.visibility = prev;
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  color: string,
  width: number
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.max(10, width * 4);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - ux * head - uy * head * 0.45, b.y - uy * head + ux * head * 0.45);
  ctx.lineTo(b.x - ux * head + uy * head * 0.45, b.y - uy * head - ux * head * 0.45);
  ctx.closePath();
  ctx.fill();
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (stroke.kind === "pen") {
    if (stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y);
    }
    ctx.stroke();
    return;
  }

  if (stroke.kind === "highlight") {
    const x = Math.min(stroke.a.x, stroke.b.x);
    const y = Math.min(stroke.a.y, stroke.b.y);
    const w = Math.abs(stroke.b.x - stroke.a.x);
    const h = Math.abs(stroke.b.y - stroke.a.y);
    ctx.fillStyle = "rgba(250, 204, 21, 0.35)";
    ctx.fillRect(x, y, w, h);
    return;
  }

  if (stroke.kind === "rect") {
    const x = Math.min(stroke.a.x, stroke.b.x);
    const y = Math.min(stroke.a.y, stroke.b.y);
    const w = Math.abs(stroke.b.x - stroke.a.x);
    const h = Math.abs(stroke.b.y - stroke.a.y);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.strokeRect(x, y, w, h);
    return;
  }

  drawArrow(ctx, stroke.a, stroke.b, stroke.color, stroke.width);
}

/**
 * Fullscreen annotate overlay inside the widget shadow root.
 * Returns a PNG File on Insert, or cancelled/error.
 */
export function openScreenshotAnnotator(
  shadowRoot: ShadowRoot,
  dataUrl: string
): Promise<AnnotateResult> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "giya-shot";
    overlay.setAttribute("data-giya-shot", "");
    overlay.innerHTML = `
      <div class="giya-shot-bar" role="toolbar" aria-label="Screenshot tools">
        <button type="button" data-tool="pen" class="giya-shot-btn is-active">Pen</button>
        <button type="button" data-tool="rect" class="giya-shot-btn">Box</button>
        <button type="button" data-tool="arrow" class="giya-shot-btn">Arrow</button>
        <button type="button" data-tool="highlight" class="giya-shot-btn">Highlight</button>
        <span class="giya-shot-sep" aria-hidden="true"></span>
        <button type="button" data-shot-undo class="giya-shot-btn">Undo</button>
        <button type="button" data-shot-clear class="giya-shot-btn">Clear</button>
        <span class="giya-shot-grow"></span>
        <button type="button" data-shot-cancel class="giya-shot-btn">Cancel</button>
        <button type="button" data-shot-insert class="giya-shot-primary">Insert</button>
      </div>
      <div class="giya-shot-stage">
        <canvas data-shot-canvas class="giya-shot-canvas"></canvas>
      </div>
    `;
    shadowRoot.appendChild(overlay);

    const canvas = overlay.querySelector("[data-shot-canvas]") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      overlay.remove();
      resolve({ ok: false, error: "Canvas unavailable." });
      return;
    }

    let tool: Tool = "pen";
    const color = "#ef4444";
    const width = 3;
    const strokes: Stroke[] = [];
    let draft: Stroke | null = null;
    let drawing = false;
    let settled = false;

    const finish = (result: AnnotateResult) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(result);
    };

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      redraw();
    };
    img.onerror = () => finish({ ok: false, error: "Failed to load screenshot." });
    img.src = dataUrl;

    const redraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const stroke of strokes) paintStroke(ctx, stroke);
      if (draft) paintStroke(ctx, draft);
    };

    const toCanvasPoint = (event: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / Math.max(1, rect.width);
      const sy = canvas.height / Math.max(1, rect.height);
      return {
        x: (event.clientX - rect.left) * sx,
        y: (event.clientY - rect.top) * sy,
      };
    };

    const setActiveTool = (next: Tool) => {
      tool = next;
      for (const btn of overlay.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
        btn.classList.toggle("is-active", btn.dataset.tool === next);
      }
    };

    overlay.querySelector(".giya-shot-bar")?.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement | null)?.closest("button");
      if (!btn) return;
      const nextTool = btn.getAttribute("data-tool") as Tool | null;
      if (nextTool) {
        setActiveTool(nextTool);
        return;
      }
      if (btn.hasAttribute("data-shot-undo")) {
        strokes.pop();
        draft = null;
        redraw();
        return;
      }
      if (btn.hasAttribute("data-shot-clear")) {
        strokes.length = 0;
        draft = null;
        redraw();
        return;
      }
      if (btn.hasAttribute("data-shot-cancel")) {
        finish({ ok: false, cancelled: true });
        return;
      }
      if (btn.hasAttribute("data-shot-insert")) {
        canvas.toBlob((blob) => {
          if (!blob) {
            finish({ ok: false, error: "Could not export screenshot." });
            return;
          }
          const file = new File([blob], `faye-screenshot-${Date.now()}.png`, {
            type: "image/png",
          });
          finish({ ok: true, file });
        }, "image/png");
      }
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      drawing = true;
      const p = toCanvasPoint(event);
      if (tool === "pen") {
        draft = { kind: "pen", points: [p], color, width };
      } else if (tool === "highlight") {
        draft = { kind: "highlight", a: p, b: p };
      } else if (tool === "rect") {
        draft = { kind: "rect", a: p, b: p, color, width };
      } else {
        draft = { kind: "arrow", a: p, b: p, color, width };
      }
      redraw();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drawing || !draft) return;
      const p = toCanvasPoint(event);
      if (draft.kind === "pen") {
        draft.points.push(p);
      } else {
        draft.b = p;
      }
      redraw();
    });

    const endStroke = (event: PointerEvent) => {
      if (!drawing) return;
      drawing = false;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      if (draft) {
        if (draft.kind === "pen" && draft.points.length < 2) {
          draft = null;
        } else {
          strokes.push(draft);
          draft = null;
        }
      }
      redraw();
    };

    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish({ ok: false, cancelled: true });
      }
    });
  });
}
