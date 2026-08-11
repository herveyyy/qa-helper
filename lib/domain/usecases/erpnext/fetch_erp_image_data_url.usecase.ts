/**
 * Load an ERP file/image with host cookies (service worker only) and
 * return a data URL so content scripts can show it on any page.
 */
export async function fetchErpImageDataUrl(
  url: string,
  timeoutMs = 8_000
): Promise<string | null> {
  if (!url || url.startsWith("data:")) return url || null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const blob = await res.blob();
    const type = blob.type || "image/png";
    if (!type.startsWith("image/")) return null;

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
