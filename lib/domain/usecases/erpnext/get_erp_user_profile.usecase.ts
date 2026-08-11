import type { UserProfile, UserResult } from "../../../entities/user.type";
import { normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { readErpIdentityCookies } from "../auth/read_erp_identity_cookies.usecase";
import { erpFetch } from "./erp_fetch.usecase";
import { fetchErpImageDataUrl } from "./fetch_erp_image_data_url.usecase";
import { getErpLoggedUser } from "./get_logged_user.usecase";

const avatarCache = new Map<string, string>();

async function withAvatarDataUrl(profile: UserProfile): Promise<UserProfile> {
  if (!profile.userImage || profile.userImage.startsWith("data:")) return profile;

  const cached = avatarCache.get(profile.userImage);
  if (cached) return { ...profile, userImage: cached };

  const dataUrl = await fetchErpImageDataUrl(profile.userImage, 4_000);
  if (dataUrl) {
    avatarCache.set(profile.userImage, dataUrl);
    return { ...profile, userImage: dataUrl };
  }
  return profile;
}

function absoluteErpUrl(site: string, path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined" || trimmed === "None") {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `${site}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function profileFromCookies(
  site: string,
  userName: string,
  identity: { fullName: string | null; userImage: string | null }
): UserProfile {
  return {
    userName,
    email: userName.includes("@") ? userName : `${userName}@erp.local`,
    fullName: identity.fullName || userName,
    userImage: absoluteErpUrl(site, identity.userImage),
    userPath: `/app/user/${encodeURIComponent(userName)}`,
  };
}

/**
 * Prefer Desk identity cookies (fast). Hit User API only when cookies lack name.
 * Avatar is converted to a data URL in the SW so pins work on any page.
 */
export async function getErpUserProfile(
  baseUrl: string,
  sid: string
): Promise<UserResult<UserProfile>> {
  const site = normalizeErpBaseUrl(baseUrl);
  if (!site) return { ok: false, error: "Invalid ERPNext base URL." };

  const identity = await readErpIdentityCookies(site);
  let userName = identity?.userId || "";

  if (!userName || userName === "Guest") {
    const logged = await getErpLoggedUser(site, sid);
    if (!logged.ok) return { ok: false, error: logged.error };
    userName = logged.data.email;
  }

  if (!userName || userName === "Guest") {
    return { ok: false, error: "Session expired." };
  }

  const cookieProfile = profileFromCookies(site, userName, {
    fullName: identity?.fullName ?? null,
    userImage: identity?.userImage ?? null,
  });

  // Cookies already have identity — skip User API; hydrate avatar for cross-origin pins.
  if (identity?.userId) {
    return { ok: true, data: await withAvatarDataUrl(cookieProfile) };
  }

  try {
    const userUrl = `${site}/api/resource/User/${encodeURIComponent(userName)}`;
    const res = await erpFetch(userUrl, {}, 4_000);

    if (!res.ok) {
      return { ok: true, data: await withAvatarDataUrl(cookieProfile) };
    }

    const json = (await res.json()) as {
      data?: {
        name?: string;
        email?: string;
        full_name?: string;
        first_name?: string;
        last_name?: string;
        user_image?: string | null;
      };
    };

    const doc = json.data;
    if (!doc) return { ok: true, data: await withAvatarDataUrl(cookieProfile) };

    const email = (doc.email || doc.name || userName).trim();
    const fullName = (
      doc.full_name ||
      [doc.first_name, doc.last_name].filter(Boolean).join(" ") ||
      identity?.fullName ||
      email
    ).trim();

    return {
      ok: true,
      data: await withAvatarDataUrl({
        userName: (doc.name || userName).trim(),
        email,
        fullName,
        firstName: doc.first_name || undefined,
        lastName: doc.last_name || undefined,
        userImage:
          absoluteErpUrl(site, doc.user_image) || absoluteErpUrl(site, identity?.userImage),
        userPath: `/app/user/${encodeURIComponent(doc.name || userName)}`,
      }),
    };
  } catch {
    return { ok: true, data: await withAvatarDataUrl(cookieProfile) };
  }
}
