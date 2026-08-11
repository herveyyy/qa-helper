/** Privileged extension fetch — let Chrome attach host cookies (incl. HttpOnly sid). */
export async function erpFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("ERP_TIMEOUT"), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      // Do NOT set Cookie manually — Chrome strips/blocks it; host_permissions + include works.
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Map AbortError / timeouts to a short UI message. */
export function erpErrorMessage(error: unknown, fallback = "Livro ERP request failed."): string {
  if (!(error instanceof Error)) return fallback;

  const name = error.name;
  const message = error.message || "";
  const cause = String((error as { cause?: unknown }).cause ?? "");

  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    message.includes("aborted") ||
    message.includes("ERP_TIMEOUT") ||
    cause.includes("ERP_TIMEOUT")
  ) {
    return "Livro ERP timed out. Retry.";
  }

  return message.trim() || fallback;
}
