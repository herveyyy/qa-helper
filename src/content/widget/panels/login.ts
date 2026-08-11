import {
  connectErpFromDesk,
  connectErpOtp,
  connectErpPassword,
} from "../../auth-client.ts";
import { ICONS } from "../../icons.ts";
import type { DockPanel } from "../../../shared/types.ts";
import { loadingMarkup, setButtonBusy } from "../dom.ts";
import type { WidgetElements } from "../types.ts";

export type LoginPanelHost = {
  otpTmpId: string | null;
  pendingLoginEmail: string;
  focusPanelField: (selector: string) => void;
  setOtpTmpId: (id: string | null) => void;
  setPendingLoginEmail: (email: string) => void;
  refreshSession: (force?: boolean) => Promise<boolean>;
  refreshPagePins: (force?: boolean) => Promise<void>;
  setPanel: (panel: DockPanel) => void;
  renderAgain: () => void;
};

export function renderLoginPanel(els: WidgetElements, host: LoginPanelHost): void {
  els.panelTitle.textContent = "Connect Livro";
  const otpMode = Boolean(host.otpTmpId);

  els.panelBody.innerHTML = otpMode
    ? `
      <div class="space-y-3">
        <p class="text-xs leading-relaxed text-neutral-600">
          Enter the verification code sent to your email (same as Desk OTP).
        </p>
        <input
          data-otp
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="Verification code"
          class="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <button
          type="button"
          data-submit-otp
          class="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-neutral-800"
        >
          ${ICONS.login}
          Verify &amp; connect
        </button>
        <button type="button" data-back-login class="w-full text-xs font-medium text-neutral-700 underline-offset-2 hover:underline">
          Back to email / password
        </button>
        <p data-auth-status class="text-xs text-neutral-500"></p>
      </div>`
    : `
      <div class="space-y-3">
        <p class="text-xs leading-relaxed text-neutral-600">
          Connect Faye to Livro with your ERP login (explicit session — not silent cookie reuse).
        </p>
        <input
          data-email
          type="email"
          autocomplete="username"
          placeholder="Email"
          class="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <input
          data-password
          type="password"
          autocomplete="current-password"
          placeholder="Password"
          class="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <button
          type="button"
          data-submit-login
          class="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-neutral-800"
        >
          ${ICONS.login}
          Connect Livro
        </button>
        <button
          type="button"
          data-connect-desk
          class="w-full rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-medium text-neutral-800 transition hover:bg-white"
        >
          Use current Desk session
        </button>
        <p data-auth-status class="text-xs text-neutral-500"></p>
      </div>`;

  const status = els.panelBody.querySelector("[data-auth-status]");
  host.focusPanelField(otpMode ? "[data-otp]" : "[data-password]");

  els.panelBody.querySelector("[data-back-login]")?.addEventListener("click", () => {
    host.setOtpTmpId(null);
    host.renderAgain();
  });

  const submitLogin = els.panelBody.querySelector(
    "[data-submit-login]"
  ) as HTMLButtonElement | null;
  submitLogin?.addEventListener("click", () => {
    void (async () => {
      const email =
        (els.panelBody.querySelector("[data-email]") as HTMLInputElement | null)?.value.trim() ||
        "";
      const pwd =
        (els.panelBody.querySelector("[data-password]") as HTMLInputElement | null)?.value || "";
      if (!email || !pwd) {
        if (status) status.textContent = "Email and password are required.";
        return;
      }
      host.setPendingLoginEmail(email);
      if (status) status.innerHTML = loadingMarkup("Connecting to Livro…");
      setButtonBusy(submitLogin, true, `${ICONS.login} Connect Livro`);
      const result = await connectErpPassword(email, pwd);
      setButtonBusy(submitLogin, false, `${ICONS.login} Connect Livro`);
      if (!result.ok) {
        if (status) status.textContent = result.error;
        return;
      }
      if (result.needsOtp) {
        host.setOtpTmpId(result.tmpId);
        host.renderAgain();
        const nextStatus = els.panelBody.querySelector("[data-auth-status]");
        if (nextStatus) nextStatus.textContent = result.prompt;
        return;
      }
      const ok = await host.refreshSession(true);
      if (!ok) {
        if (status) status.textContent = "Connected but session not ready. Retry.";
        return;
      }
      void host.refreshPagePins(true);
      host.setPanel("concerns");
    })();
  });

  const submitOtp = els.panelBody.querySelector(
    "[data-submit-otp]"
  ) as HTMLButtonElement | null;
  submitOtp?.addEventListener("click", () => {
    void (async () => {
      const otp =
        (els.panelBody.querySelector("[data-otp]") as HTMLInputElement | null)?.value.trim() ||
        "";
      if (!host.otpTmpId || !otp) {
        if (status) status.textContent = "Enter the verification code.";
        return;
      }
      if (status) status.innerHTML = loadingMarkup("Verifying…");
      setButtonBusy(submitOtp, true, `${ICONS.login} Verify & connect`);
      const result = await connectErpOtp(host.otpTmpId, otp, host.pendingLoginEmail);
      setButtonBusy(submitOtp, false, `${ICONS.login} Verify & connect`);
      if (!result.ok) {
        if (status) status.textContent = result.error;
        return;
      }
      host.setOtpTmpId(null);
      const ok = await host.refreshSession(true);
      if (!ok) {
        if (status) status.textContent = "Connected but session not ready. Retry.";
        return;
      }
      void host.refreshPagePins(true);
      host.setPanel("concerns");
    })();
  });

  const deskBtn = els.panelBody.querySelector(
    "[data-connect-desk]"
  ) as HTMLButtonElement | null;
  deskBtn?.addEventListener("click", () => {
    void (async () => {
      if (status) status.innerHTML = loadingMarkup("Linking Desk SID…");
      setButtonBusy(deskBtn, true, "Use current Desk session");
      const result = await connectErpFromDesk();
      setButtonBusy(deskBtn, false, "Use current Desk session");
      if (!result.ok) {
        if (status) status.textContent = result.error;
        return;
      }
      const ok = await host.refreshSession(true);
      if (!ok) {
        if (status) status.textContent = "Connected but session not ready. Retry.";
        return;
      }
      void host.refreshPagePins(true);
      host.setPanel("concerns");
    })();
  });
}
