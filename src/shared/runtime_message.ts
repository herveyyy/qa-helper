import type { ExtensionRequest, ExtensionResponse } from "./messages.ts";

type RuntimeWithCallback = {
  id?: string;
  lastError?: { message?: string };
  sendMessage: (
    message: ExtensionRequest,
    responseCallback: (response: ExtensionResponse | undefined) => void
  ) => void;
};

export function extensionAlive(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

/**
 * Content/page → service worker messaging.
 * Uses the callback form so a closed channel becomes lastError (not an uncaught rejection).
 */
export function sendRuntimeMessage(
  message: ExtensionRequest
): Promise<ExtensionResponse | null> {
  if (!extensionAlive()) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const runtime = chrome.runtime as unknown as RuntimeWithCallback;
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
