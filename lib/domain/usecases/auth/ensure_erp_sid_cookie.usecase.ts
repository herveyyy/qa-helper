import { normalizeErpBaseUrl } from "../../../entities/erpnext.type";

type IdentityHints = {
  userId?: string;
  fullName?: string;
};

async function setCookie(
  url: string,
  name: string,
  value: string,
  httpOnly: boolean
): Promise<boolean> {
  try {
    const result = await chrome.cookies.set({
      url,
      name,
      value,
      path: "/",
      secure: true,
      httpOnly,
      sameSite: "lax",
    });
    return Boolean(result);
  } catch {
    return false;
  }
}

/** Write Livro `sid` (+ identity hints) so host_permissions fetch can use it. */
export async function ensureErpSidCookie(
  baseUrl: string,
  sid: string,
  identity: IdentityHints = {}
): Promise<boolean> {
  const site = normalizeErpBaseUrl(baseUrl);
  const value = sid.trim();
  if (!site || !value || value === "Guest") return false;

  let ok = await setCookie(site, "sid", value, true);
  if (!ok) ok = await setCookie(site, "sid", value, false);

  if (identity.userId?.trim()) {
    await setCookie(site, "user_id", identity.userId.trim(), false);
  }
  if (identity.fullName?.trim()) {
    await setCookie(site, "full_name", identity.fullName.trim(), false);
  }

  try {
    const check = await chrome.cookies.get({ url: site, name: "sid" });
    const stored = check?.value?.trim() ?? "";
    return Boolean(stored && stored !== "Guest");
  } catch {
    return ok;
  }
}
