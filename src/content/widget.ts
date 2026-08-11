import { HOST_ID } from "./constants.ts";
import { isUrlAllowed } from "../shared/allowed_origins.ts";
import { STORAGE_DEFAULTS } from "../shared/defaults.ts";
import { loadConfig } from "./widget/dom.ts";
import { FloatingWidget } from "./widget/floating-widget.ts";

async function boot(): Promise<void> {
  // After reload/update, old content scripts die — skip instead of crashing the page.
  try {
    if (!chrome.runtime?.id) return;
  } catch {
    return;
  }

  const stored = await chrome.storage.sync.get(STORAGE_DEFAULTS);
  const allowed =
    Array.isArray(stored.allowedOrigins) && stored.allowedOrigins.length > 0
      ? (stored.allowedOrigins as string[])
      : STORAGE_DEFAULTS.allowedOrigins;
  if (!isUrlAllowed(location.href, allowed)) return;

  const config = await loadConfig();
  const widget = new FloatingWidget(config);
  await widget.mount();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (!chrome.runtime?.id || area !== "sync") return;
    if (changes.allowedOrigins) {
      const next = Array.isArray(changes.allowedOrigins.newValue)
        ? (changes.allowedOrigins.newValue as string[])
        : STORAGE_DEFAULTS.allowedOrigins;
      if (!isUrlAllowed(location.href, next)) {
        document.getElementById(HOST_ID)?.remove();
        return;
      }
    }
    widget.updateFromStorage(changes);
  });
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void boot();
    },
    { once: true }
  );
} else {
  void boot();
}
