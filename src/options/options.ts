import { DEFAULT_ALLOWED_ORIGINS, defaultIconUrl } from "../shared/defaults.ts";

const preview = document.getElementById("preview") as HTMLImageElement;
const fileInput = document.getElementById("file") as HTMLInputElement;
const urlInput = document.getElementById("url") as HTMLInputElement;
const saveUrlBtn = document.getElementById("save-url") as HTMLButtonElement;
const resetBtn = document.getElementById("reset") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const originsList = document.getElementById("origins-list") as HTMLUListElement;
const originInput = document.getElementById("origin-input") as HTMLInputElement;
const originAddBtn = document.getElementById("origin-add") as HTMLButtonElement;
const originsResetBtn = document.getElementById("origins-reset") as HTMLButtonElement;

function setStatus(message: string): void {
  statusEl.textContent = message;
}

async function getAllowedOrigins(): Promise<string[]> {
  const { allowedOrigins } = await chrome.storage.sync.get({
    allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
  });
  return Array.isArray(allowedOrigins) && allowedOrigins.length
    ? allowedOrigins.map(String)
    : [...DEFAULT_ALLOWED_ORIGINS];
}

async function setAllowedOrigins(origins: string[]): Promise<void> {
  const cleaned = [
    ...new Set(origins.map((o) => o.trim()).filter(Boolean)),
  ];
  await chrome.storage.sync.set({
    allowedOrigins: cleaned.length ? cleaned : [...DEFAULT_ALLOWED_ORIGINS],
  });
}

function renderOrigins(origins: string[]): void {
  originsList.replaceChildren();
  for (const origin of origins) {
    const li = document.createElement("li");
    li.className =
      "flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm";

    const label = document.createElement("code");
    label.className = "min-w-0 truncate text-neutral-800";
    label.textContent = origin;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className =
      "shrink-0 text-xs font-medium text-red-600 hover:text-red-700";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      void (async () => {
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

async function refreshOrigins(): Promise<void> {
  renderOrigins(await getAllowedOrigins());
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

originAddBtn.addEventListener("click", () => {
  void (async () => {
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
  void (async () => {
    await setAllowedOrigins([...DEFAULT_ALLOWED_ORIGINS]);
    await refreshOrigins();
    setStatus("Allowed sites reset to wela.dev.");
  })();
});

void refreshPreview();
void refreshOrigins();
