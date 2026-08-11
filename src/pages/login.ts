import type { ExtensionRequest, ExtensionResponse } from "../shared/messages.ts";

const signedOut = document.getElementById("signed-out")!;
const signedIn = document.getElementById("signed-in")!;
const emailEl = document.getElementById("email")!;
const statusEl = document.getElementById("status")!;
const loginBtn = document.getElementById("login-livro")!;
const recheckBtn = document.getElementById("recheck")!;
const closeBtn = document.getElementById("close-tab")!;

function setStatus(message: string): void {
  statusEl.textContent = message;
}

async function send<T extends ExtensionResponse>(message: ExtensionRequest): Promise<T> {
  return (await chrome.runtime.sendMessage(message)) as T;
}

async function refresh(force = true): Promise<void> {
  setStatus(force ? "Checking Livro SID…" : "Loading…");
  const response = await send<Extract<ExtensionResponse, { type: "SESSION" }>>({
    type: "GET_SESSION",
    force,
  });

  if (response.ok) {
    signedOut.classList.add("hidden");
    signedIn.classList.remove("hidden");
    emailEl.textContent = response.session.email;
    setStatus("Session valid.");
    return;
  }

  signedIn.classList.add("hidden");
  signedOut.classList.remove("hidden");
  setStatus(response.error || "Login required.");
}

loginBtn.addEventListener("click", () => {
  void send({ type: "OPEN_LIVRO_LOGIN" });
  setStatus("Finish login in the Livro tab, then check SID here.");
});

recheckBtn.addEventListener("click", () => {
  void refresh(true);
});

closeBtn.addEventListener("click", () => {
  window.close();
});

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === "AUTH_CHANGED") {
    void refresh(true);
  }
  return undefined;
});

void refresh(true);
