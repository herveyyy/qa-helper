import { disconnectErp } from "../../auth-client.ts";
import type { UserProfile } from "../../../../lib/entities/user.type";
import { defaultIconUrl } from "../../../shared/defaults.ts";
import { escapeHtml, loadingMarkup } from "../dom.ts";
import type { WidgetElements } from "../types.ts";

export type ProfilePanelHost = {
  ensureProfile: (force?: boolean) => Promise<UserProfile | null>;
  avatarUrl: () => string;
  showPanelVisual: () => void;
  onDisconnected: () => void;
};

export async function renderProfilePanel(
  els: WidgetElements,
  host: ProfilePanelHost
): Promise<void> {
  els.panelTitle.textContent = "Profile";
  els.panelBody.innerHTML = loadingMarkup("Loading profile…");
  host.showPanelVisual();

  const profile = await host.ensureProfile(true);
  if (!profile) {
    els.panelBody.innerHTML = `<p class="text-xs text-neutral-600">Could not load profile.</p>`;
    return;
  }

  const avatar = host.avatarUrl();
  els.panelBody.innerHTML = `
      <div class="flex flex-col items-center gap-3 text-center">
        <img src="${escapeHtml(avatar)}" alt="" class="h-16 w-16 rounded-full object-cover shadow-md ring-2 ring-white" />
        <div>
          <p class="text-sm font-semibold text-neutral-900">${escapeHtml(profile.fullName)}</p>
          <p class="mt-0.5 break-all text-xs text-neutral-500">${escapeHtml(profile.email)}</p>
        </div>
        <p class="w-full break-all rounded-xl border border-black/5 bg-white/50 px-2.5 py-2 text-left font-mono text-[10px] text-neutral-500">
          ${escapeHtml(profile.userName)}
        </p>
        <button
          type="button"
          data-disconnect
          class="w-full rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-medium text-neutral-800 transition hover:bg-white"
        >
          Disconnect Livro
        </button>
      </div>
    `;
  const img = els.panelBody.querySelector("img");
  if (img) {
    img.onerror = () => {
      img.src = defaultIconUrl();
    };
  }
  els.panelBody.querySelector("[data-disconnect]")?.addEventListener("click", () => {
    void (async () => {
      await disconnectErp();
      host.onDisconnected();
    })();
  });
}
