(() => {
  // src/shared/runtime_message.ts
  function extensionAlive() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }
  function sendRuntimeMessage(message) {
    if (!extensionAlive())
      return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const runtime = chrome.runtime;
        runtime.sendMessage(message, (response) => {
          if (runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response ?? null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  // src/pages/login.ts
  var signedOut = document.getElementById("signed-out");
  var signedIn = document.getElementById("signed-in");
  var emailEl = document.getElementById("email");
  var statusEl = document.getElementById("status");
  var loginBtn = document.getElementById("login-livro");
  var recheckBtn = document.getElementById("recheck");
  var closeBtn = document.getElementById("close-tab");
  function setStatus(message) {
    statusEl.textContent = message;
  }
  async function refresh(force = true) {
    setStatus(force ? "Checking Livro SID…" : "Loading…");
    const response = await sendRuntimeMessage({
      type: "GET_SESSION",
      force
    });
    if (response?.type !== "SESSION") {
      signedIn.classList.add("hidden");
      signedOut.classList.remove("hidden");
      setStatus("Reload this page — Faye was updated.");
      return;
    }
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
    sendRuntimeMessage({ type: "OPEN_LIVRO_LOGIN" });
    setStatus("Finish login in the Livro tab, then check SID here.");
  });
  recheckBtn.addEventListener("click", () => {
    refresh(true);
  });
  closeBtn.addEventListener("click", () => {
    window.close();
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "AUTH_CHANGED") {
      refresh(true);
    }
    return;
  });
  refresh(true);
})();

//# debugId=D731CEF14A3A26CF64756E2164756E21
//# sourceMappingURL=login.js.map
