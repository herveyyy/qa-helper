import type { GiyaPinComment } from "../../../lib/entities/concern.type";
import type { UserProfile } from "../../../lib/entities/user.type";
import { listPagePins } from "../concern-client.ts";
import { ICONS } from "../icons.ts";
import { defaultIconUrl } from "../../shared/defaults.ts";
import { escapeHtml } from "./dom.ts";
import type { WidgetElements } from "./types.ts";

export function renderPinLoadingBadge(els: WidgetElements, show: boolean): void {
  els.pinLayer.querySelector("[data-pin-loading]")?.remove();
  if (!show) return;

  const badge = document.createElement("div");
  badge.dataset.pinLoading = "1";
  badge.className =
    "pointer-events-none fixed bottom-4 right-4 z-[5] flex items-center gap-2 rounded-full border border-white/50 bg-white/80 px-3 py-1.5 text-xs text-neutral-600 shadow-md backdrop-blur-md";
  badge.setAttribute("role", "status");
  badge.setAttribute("aria-live", "polite");
  badge.innerHTML = `${ICONS.spinner}<span>Loading pins…</span>`;
  els.pinLayer.appendChild(badge);
}

export function clearDraftPin(els: WidgetElements): void {
  els.pinLayer.querySelector("[data-draft-pin]")?.remove();
}

export function renderDraftPin(els: WidgetElements, rect: DOMRect, avatarUrl: string): void {
  clearDraftPin(els);
  const wrap = document.createElement("div");
  wrap.dataset.draftPin = "1";
  wrap.className = "pointer-events-auto absolute";
  wrap.style.left = `${rect.left}px`;
  wrap.style.top = `${Math.max(8, rect.top - 8)}px`;
  wrap.innerHTML = `
      <div class="relative h-8 w-8">
        <img
          src="${escapeHtml(avatarUrl)}"
          alt=""
          class="h-8 w-8 rounded-full object-cover shadow-lg ring-2 ring-white"
        />
        <span class="absolute -right-1 -bottom-1 grid h-4 w-4 place-items-center rounded-full bg-sky-500 text-[10px] font-bold leading-none text-white ring-2 ring-white">+</span>
      </div>
    `;
  const img = wrap.querySelector("img");
  if (img) {
    img.onerror = () => {
      img.src = defaultIconUrl();
    };
  }
  els.pinLayer.appendChild(wrap);
}

export function renderSavedPins(
  els: WidgetElements,
  pagePins: GiyaPinComment[],
  profile: UserProfile | null,
  avatarUrl: string,
  onOpen: (item: GiyaPinComment) => void
): void {
  for (const node of els.pinLayer.querySelectorAll("[data-saved-pin]")) {
    node.remove();
  }

  for (const item of pagePins) {
    let target: Element | null = null;
    try {
      target = document.querySelector(item.pin.selector);
    } catch {
      target = null;
    }
    if (!target) continue;

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) continue;

    const pin = document.createElement("div");
    pin.dataset.savedPin = item.commentName;
    pin.className = "pointer-events-auto absolute";
    pin.style.left = `${rect.left}px`;
    pin.style.top = `${Math.max(8, rect.top - 8)}px`;
    pin.title = `${item.concernName}: ${item.pin.text}`;
    const avatar =
      item.commentEmail === profile?.email || item.commentEmail === profile?.userName
        ? avatarUrl
        : defaultIconUrl();
    pin.innerHTML = `
        <button type="button" class="relative h-8 w-8" aria-label="Open pin comment">
          <img src="${escapeHtml(avatar)}" alt="" class="h-8 w-8 rounded-full object-cover shadow-lg ring-2 ring-sky-400" />
        </button>
      `;
    const img = pin.querySelector("img");
    if (img) {
      img.onerror = () => {
        img.src = defaultIconUrl();
      };
    }
    pin.querySelector("button")?.addEventListener("click", () => {
      onOpen(item);
    });
    els.pinLayer.appendChild(pin);
  }
}

export function showSavedPinPopout(els: WidgetElements, item: GiyaPinComment): void {
  els.panelTitle.textContent = item.concernName;
  els.panelBody.innerHTML = `
      <div class="space-y-2">
        <p class="text-xs font-medium text-neutral-900">${escapeHtml(item.concernSubject)}</p>
        <p class="text-xs text-neutral-500">${escapeHtml(item.commentBy)}</p>
        <p class="rounded-xl border border-black/8 bg-white/60 px-2.5 py-2 text-sm text-neutral-800">${escapeHtml(item.pin.text)}</p>
        <p class="break-all text-[10px] text-neutral-500">${escapeHtml(item.pin.label)}</p>
      </div>
    `;
}

export async function fetchPagePins(href: string): Promise<GiyaPinComment[]> {
  const result = await listPagePins(href);
  return result.ok ? result.pins : [];
}
