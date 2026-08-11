(() => {
  // src/shared/defaults.ts
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
  function setStatus(message) {
    statusEl.textContent = message;
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
  refreshPreview();
})();

//# debugId=2C099ACFCF21E1DF64756E2164756E21
//# sourceMappingURL=options.js.map
