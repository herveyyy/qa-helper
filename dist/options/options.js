(() => {
  // src/shared/defaults.ts
  var DEFAULT_ALLOWED_ORIGINS = ["wela.dev"];
  function defaultIconUrl() {
    return chrome.runtime.getURL("assets/giya-icon.png");
  }

  // src/options/options.ts
  var preview = document.getElementById("preview");
  var fileInput = document.getElementById("file");
  var urlInput = document.getElementById("url");
  var saveUrlBtn = document.getElementById("save-url");
  var resetBtn = document.getElementById("reset");
  var statusEl = document.getElementById("status");
  var originsList = document.getElementById("origins-list");
  var originInput = document.getElementById("origin-input");
  var originAddBtn = document.getElementById("origin-add");
  var originsResetBtn = document.getElementById("origins-reset");
  function setStatus(message) {
    statusEl.textContent = message;
  }
  async function getAllowedOrigins() {
    const { allowedOrigins } = await chrome.storage.sync.get({
      allowedOrigins: DEFAULT_ALLOWED_ORIGINS
    });
    return Array.isArray(allowedOrigins) && allowedOrigins.length ? allowedOrigins.map(String) : [...DEFAULT_ALLOWED_ORIGINS];
  }
  async function setAllowedOrigins(origins) {
    const cleaned = [
      ...new Set(origins.map((o) => o.trim()).filter(Boolean))
    ];
    await chrome.storage.sync.set({
      allowedOrigins: cleaned.length ? cleaned : [...DEFAULT_ALLOWED_ORIGINS]
    });
  }
  function renderOrigins(origins) {
    originsList.replaceChildren();
    for (const origin of origins) {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm";
      const label = document.createElement("code");
      label.className = "min-w-0 truncate text-neutral-800";
      label.textContent = origin;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "shrink-0 text-xs font-medium text-red-600 hover:text-red-700";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        (async () => {
          const next = (await getAllowedOrigins()).filter((o) => o !== origin);
          await setAllowedOrigins(next);
          await refreshOrigins();
          setStatus("Allowed sites updated. Reload open tabs to remount.");
        })();
      });
      li.append(label, remove);
      originsList.appendChild(li);
    }
  }
  async function refreshOrigins() {
    renderOrigins(await getAllowedOrigins());
  }
  async function refreshPreview() {
    const { iconUrl } = await chrome.storage.sync.get({ iconUrl: "" });
    preview.src = iconUrl || defaultIconUrl();
    if (iconUrl && !iconUrl.startsWith("data:")) {
      urlInput.value = iconUrl;
    }
  }
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader;
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }
  fileInput.addEventListener("change", () => {
    (async () => {
      const file = fileInput.files?.[0];
      if (!file)
        return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        await chrome.storage.sync.set({ iconUrl: dataUrl });
        urlInput.value = "";
        await refreshPreview();
        setStatus("Icon updated from file.");
      } catch {
        setStatus("Could not read that image.");
      }
    })();
  });
  saveUrlBtn.addEventListener("click", () => {
    (async () => {
      const value = urlInput.value.trim();
      if (!value) {
        setStatus("Enter an image URL first.");
        return;
      }
      await chrome.storage.sync.set({ iconUrl: value });
      await refreshPreview();
      setStatus("Icon URL saved.");
    })();
  });
  resetBtn.addEventListener("click", () => {
    (async () => {
      await chrome.storage.sync.set({ iconUrl: "" });
      urlInput.value = "";
      fileInput.value = "";
      await refreshPreview();
      setStatus("Reset to the default Giya logo.");
    })();
  });
  originAddBtn.addEventListener("click", () => {
    (async () => {
      const value = originInput.value.trim();
      if (!value) {
        setStatus("Enter a host or origin pattern first.");
        return;
      }
      const current = await getAllowedOrigins();
      if (current.some((o) => o.toLowerCase() === value.toLowerCase())) {
        setStatus("That pattern is already listed.");
        return;
      }
      await setAllowedOrigins([...current, value]);
      originInput.value = "";
      await refreshOrigins();
      setStatus("Allowed sites updated. Reload open tabs to remount.");
    })();
  });
  originInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      originAddBtn.click();
    }
  });
  originsResetBtn.addEventListener("click", () => {
    (async () => {
      await setAllowedOrigins([...DEFAULT_ALLOWED_ORIGINS]);
      await refreshOrigins();
      setStatus("Allowed sites reset to wela.dev.");
    })();
  });
  refreshPreview();
  refreshOrigins();
})();

//# debugId=B9A1A9148EE80ADC64756E2164756E21
//# sourceMappingURL=options.js.map
