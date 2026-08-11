/** Only Livro ERP origin this extension talks to. */
export const ERP_HOST = "erp.livro.systems";
export const ERP_BASE_URL = `https://${ERP_HOST}`;

/**
 * Normalize and pin to erp.livro.systems.
 * Rejects other hosts so API calls never hit the page origin (e.g. *.wela.dev).
 */
export function normalizeErpBaseUrl(raw?: string | null): string | null {
  const value = (raw || ERP_BASE_URL).trim();
  if (!value) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    const host = url.hostname.toLowerCase();
    if (host !== ERP_HOST && host !== `www.${ERP_HOST}`) {
      return null;
    }
    return ERP_BASE_URL;
  } catch {
    return null;
  }
}

export function erpLoginUrl(baseUrl = ERP_BASE_URL): string {
  const origin = normalizeErpBaseUrl(baseUrl) || ERP_BASE_URL;
  return `${origin}/login`;
}
