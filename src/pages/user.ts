import { sendRuntimeMessage } from "../shared/runtime_message.ts";

const loadingEl = document.getElementById("loading")!;
const errorEl = document.getElementById("error")!;
const errorText = document.getElementById("error-text")!;
const profileEl = document.getElementById("profile")!;
const avatarEl = document.getElementById("avatar") as HTMLImageElement;
const fullNameEl = document.getElementById("full-name")!;
const emailEl = document.getElementById("email")!;
const userNameEl = document.getElementById("user-name")!;
const deskLink = document.getElementById("desk-link") as HTMLAnchorElement;
const statusEl = document.getElementById("status")!;
const refreshBtn = document.getElementById("refresh")!;
const closeBtn = document.getElementById("close-tab")!;
const goLoginBtn = document.getElementById("go-login")!;

const FALLBACK_AVATAR = chrome.runtime.getURL("assets/giya-icon.png");

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function showLoading(): void {
  loadingEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  profileEl.classList.add("hidden");
}

function showError(message: string): void {
  loadingEl.classList.add("hidden");
  profileEl.classList.add("hidden");
  errorEl.classList.remove("hidden");
  errorText.textContent = message;
}

function showProfile(profile: {
  fullName: string;
  email: string;
  userName: string;
  userImage: string | null;
  userPath: string;
}): void {
  loadingEl.classList.add("hidden");
  errorEl.classList.add("hidden");
  profileEl.classList.remove("hidden");

  fullNameEl.textContent = profile.fullName;
  emailEl.textContent = profile.email;
  userNameEl.textContent = profile.userName;
  avatarEl.src = profile.userImage || FALLBACK_AVATAR;
  avatarEl.onerror = () => {
    avatarEl.src = FALLBACK_AVATAR;
  };

  const deskUrl = `https://erp.livro.systems${profile.userPath}`;
  deskLink.href = deskUrl;
  deskLink.textContent = deskUrl;
}

async function loadProfile(): Promise<void> {
  showLoading();
  setStatus("Fetching Livro user…");

  const response = await sendRuntimeMessage({ type: "GET_USER_PROFILE" });

  if (response?.type !== "USER_PROFILE" || !response.ok) {
    showError(
      response?.type === "USER_PROFILE"
        ? response.error
        : "Could not load profile."
    );
    setStatus("Sign in with Livro, then refresh.");
    return;
  }

  showProfile(response.profile);
  setStatus("Profile loaded from erp.livro.systems");
}

refreshBtn.addEventListener("click", () => {
  void loadProfile();
});

closeBtn.addEventListener("click", () => {
  window.close();
});

goLoginBtn.addEventListener("click", () => {
  void sendRuntimeMessage({ type: "OPEN_LOGIN_PAGE" });
});

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === "AUTH_CHANGED") {
    void loadProfile();
  }
  return undefined;
});

void loadProfile();
