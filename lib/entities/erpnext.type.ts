/** Main API origin for this client extension. */
export const ERP_BASE_URL = "https://erp.livro.systems";

export function normalizeErpBaseUrl(raw?: string | null): string | null {
  const value = (raw || ERP_BASE_URL).trim();
  if (!value) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    return url.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function erpLoginUrl(baseUrl = ERP_BASE_URL): string {
  const origin = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  return `${origin}/login`;
}
