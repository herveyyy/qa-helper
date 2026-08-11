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

async function readCookie(url: string, name: string): Promise<string> {
  try {
    const cookie = await chrome.cookies.get({ url, name });
    return cookie?.value?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * Write Livro `sid` (+ identity hints) only when missing/mismatched.
 * Always rewriting sid triggers cookies.onChanged → AUTH_CHANGED storms.
 */
export async function ensureErpSidCookie(
  baseUrl: string,
  sid: string,
  identity: IdentityHints = {}
): Promise<boolean> {
  const site = normalizeErpBaseUrl(baseUrl);
  const value = sid.trim();
  if (!site || !value || value === "Guest") return false;

  const currentSid = await readCookie(site, "sid");
  let wrote = false;

  if (currentSid !== value) {
    let ok = await setCookie(site, "sid", value, true);
    if (!ok) ok = await setCookie(site, "sid", value, false);
    wrote = ok;
  }

  const wantUser = identity.userId?.trim() || "";
  if (wantUser) {
    const currentUser = await readCookie(site, "user_id");
    if (currentUser !== wantUser) {
      await setCookie(site, "user_id", wantUser, false);
      wrote = true;
    }
  }

  const wantName = identity.fullName?.trim() || "";
  if (wantName) {
    const currentName = await readCookie(site, "full_name");
    if (currentName !== wantName) {
      await setCookie(site, "full_name", wantName, false);
      wrote = true;
    }
  }

  if (currentSid === value || wrote) {
    const stored = await readCookie(site, "sid");
    return Boolean(stored && stored !== "Guest");
  }

  return false;
}
