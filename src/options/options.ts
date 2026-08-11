import { defaultIconUrl } from "../shared/defaults.ts";

const preview = document.getElementById("preview") as HTMLImageElement;
const fileInput = document.getElementById("file") as HTMLInputElement;
const urlInput = document.getElementById("url") as HTMLInputElement;
const saveUrlBtn = document.getElementById("save-url") as HTMLButtonElement;
const resetBtn = document.getElementById("reset") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;

function setStatus(message: string): void {
  statusEl.textContent = message;
}

async function refreshPreview(): Promise<void> {
  const { iconUrl } = await chrome.storage.sync.get({ iconUrl: "" });
  preview.src = iconUrl || defaultIconUrl();
  if (iconUrl && !iconUrl.startsWith("data:")) {
    urlInput.value = iconUrl;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

fileInput.addEventListener("change", () => {
  void (async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

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
  void (async () => {
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
  void (async () => {
    await chrome.storage.sync.set({ iconUrl: "" });
    urlInput.value = "";
    fileInput.value = "";
    await refreshPreview();
    setStatus("Reset to the default Giya logo.");
  })();
});

void refreshPreview();
