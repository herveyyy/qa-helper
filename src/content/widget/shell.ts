import { ICONS } from "../icons.ts";
import { ICON_BTN_CLASS } from "./types.ts";

/** Shadow-root chrome markup (dock, panel, FAB, overlays). */
export function widgetShellHtml(): string {
  return `
      <div data-backdrop class="pointer-events-auto fixed inset-0 bg-black/10 opacity-0 transition-opacity duration-200 ease-out invisible" aria-hidden="true"></div>

      <div
        data-highlight
        class="pointer-events-none fixed z-1 rounded-md border-2 border-neutral-900 bg-neutral-900/10 opacity-0 transition-opacity duration-75"
        hidden
      ></div>

      <div
        data-pick-hint
        class="pointer-events-none fixed bottom-4 left-1/2 z-5 -translate-x-1/2 rounded-full border border-white/50 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-150"
        hidden
      >
        Click an element to comment · Esc to cancel
      </div>

      <div data-pin-layer class="pointer-events-none fixed inset-0 z-3"></div>

      <div
        data-dock
        class="pointer-events-auto fixed z-3 flex flex-col items-center gap-1 rounded-full border border-white/50 bg-white/55 p-1.5 shadow-lg shadow-black/10 backdrop-blur-xl transition duration-200 ease-out scale-95 opacity-0"
        role="toolbar"
        aria-label="Faye"
        hidden
      >
        <button type="button" data-nav class="${ICON_BTN_CLASS}" aria-label="Concerns" title="Concerns" data-active="false" data-mode="concerns">
          ${ICONS.concerns}
        </button>
        <button type="button" data-env class="${ICON_BTN_CLASS}" aria-label="Environment" title="Environment" data-active="false">
          ${ICONS.environment}
        </button>
        <button type="button" data-user class="${ICON_BTN_CLASS}" aria-label="Profile" title="Profile" data-active="false">
          ${ICONS.user}
        </button>
        <button type="button" data-theme class="${ICON_BTN_CLASS}" aria-label="Toggle theme" title="Light mode" data-active="false" aria-pressed="true">
          ${ICONS.sun}
        </button>
        <button type="button" data-pin class="${ICON_BTN_CLASS}" aria-label="Pin toolbar" title="Pin toolbar" data-active="false" aria-pressed="false">
          ${ICONS.pin}
        </button>
      </div>

      <section
        data-panel
        class="pointer-events-auto fixed z-4 flex flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/70 text-neutral-900 shadow-xl shadow-black/10 backdrop-blur-2xl transition duration-200 ease-out scale-95 opacity-0"
        role="dialog"
        aria-label="Faye panel"
        hidden
      >
        <header data-panel-header class="flex shrink-0 cursor-grab items-center gap-2 border-b border-black/5 px-3 py-2 active:cursor-grabbing touch-none select-none">
          <h2 data-panel-title class="flex-1 text-xs font-semibold tracking-tight text-neutral-800"></h2>
          <button type="button" data-close-panel class="${ICON_BTN_CLASS} cursor-pointer" aria-label="Close panel">
            ${ICONS.close}
          </button>
        </header>
        <div data-panel-body class="min-h-0 flex-1 overflow-auto px-3 py-3 text-sm"></div>
        <div
          data-panel-resize
          class="absolute right-0 bottom-0 h-4 w-4 cursor-se-resize touch-none"
          aria-label="Resize panel"
          title="Drag to resize"
        >
          <span class="pointer-events-none absolute right-1 bottom-1 block h-2 w-2 border-r-2 border-b-2 border-neutral-400/80"></span>
        </div>
      </section>

      <button
        type="button"
        data-fab
        class="pointer-events-auto fixed z-2 grid h-8 w-8 place-items-center rounded-full border border-white/40 bg-black p-0 shadow-md transition-transform duration-150 ease-out hover:scale-105 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black cursor-grab active:cursor-grabbing touch-none select-none"
        aria-label="Open Faye"
        aria-expanded="false"
      >
        <img data-fab-icon class="pointer-events-none h-4 w-4 rounded-full object-cover" alt="" draggable="false" />
      </button>
    `;
}
