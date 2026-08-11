import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";

export type ErpIdentityCookies = {
  sid: string;
  userId: string | null;
  fullName: string | null;
  userImage: string | null;
  csrfToken: string | null;
};

function decodeCookieValue(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).trim() || null;
  } catch {
    return raw.trim() || null;
  }
}

/** Read Livro identity cookies via chrome.cookies (works for HttpOnly sid). */
export async function readErpIdentityCookies(
  baseUrl: string = ERP_BASE_URL
): Promise<ErpIdentityCookies | null> {
  const site = normalizeErpBaseUrl(baseUrl);
  if (!site) return null;

  try {
    const [sidCookie, userIdCookie, fullNameCookie, userImageCookie, csrfCookie] =
      await Promise.all([
        chrome.cookies.get({ url: site, name: "sid" }),
        chrome.cookies.get({ url: site, name: "user_id" }),
        chrome.cookies.get({ url: site, name: "full_name" }),
        chrome.cookies.get({ url: site, name: "user_image" }),
        chrome.cookies.get({ url: site, name: "csrf_token" }),
      ]);

    const sid = sidCookie?.value?.trim() ?? "";
    if (!sid || sid === "Guest") return null;

    return {
      sid,
      userId: decodeCookieValue(userIdCookie?.value),
      fullName: decodeCookieValue(fullNameCookie?.value),
      userImage: decodeCookieValue(userImageCookie?.value),
      csrfToken: decodeCookieValue(csrfCookie?.value),
    };
  } catch {
    return null;
  }
}
