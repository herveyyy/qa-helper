(() => {
  // src/pages/user.ts
  var loadingEl = document.getElementById("loading");
  var errorEl = document.getElementById("error");
  var errorText = document.getElementById("error-text");
  var profileEl = document.getElementById("profile");
  var avatarEl = document.getElementById("avatar");
  var fullNameEl = document.getElementById("full-name");
  var emailEl = document.getElementById("email");
  var userNameEl = document.getElementById("user-name");
  var deskLink = document.getElementById("desk-link");
  var statusEl = document.getElementById("status");
  var refreshBtn = document.getElementById("refresh");
  var closeBtn = document.getElementById("close-tab");
  var goLoginBtn = document.getElementById("go-login");
  var FALLBACK_AVATAR = chrome.runtime.getURL("assets/giya-icon.png");
  function setStatus(message) {
    statusEl.textContent = message;
  }
  async function send(message) {
    return await chrome.runtime.sendMessage(message);
  }
  function showLoading() {
    loadingEl.classList.remove("hidden");
    errorEl.classList.add("hidden");
    profileEl.classList.add("hidden");
  }
  function showError(message) {
    loadingEl.classList.add("hidden");
    profileEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorText.textContent = message;
  }
  function showProfile(profile) {
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
  async function loadProfile() {
    showLoading();
    setStatus("Fetching Livro user…");
    const response = await send({
      type: "GET_USER_PROFILE"
    });
    if (!response.ok) {
      showError(response.error || "Could not load profile.");
      setStatus("Sign in with Livro, then refresh.");
      return;
    }
    showProfile(response.profile);
    setStatus("Profile loaded from erp.livro.systems");
  }
  refreshBtn.addEventListener("click", () => {
    loadProfile();
  });
  closeBtn.addEventListener("click", () => {
    window.close();
  });
  goLoginBtn.addEventListener("click", () => {
    send({ type: "OPEN_LOGIN_PAGE" });
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "AUTH_CHANGED") {
      loadProfile();
    }
    return;
  });
  loadProfile();
})();

//# debugId=AC18ACDE7B4FAB9E64756E2164756E21
//# sourceMappingURL=user.js.map
