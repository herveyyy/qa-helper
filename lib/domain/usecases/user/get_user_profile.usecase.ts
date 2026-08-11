import type { UserProfile, UserResult } from "../../../entities/user.type";
import { ERP_BASE_URL } from "../../../entities/erpnext.type";
import { getExtensionSession } from "../auth/get_extension_session.usecase";
import { getErpUserProfile } from "../erpnext/get_erp_user_profile.usecase";

export async function getUserProfile(
  baseUrl: string = ERP_BASE_URL
): Promise<UserResult<UserProfile>> {
  const session = await getExtensionSession(baseUrl);
  if (!session.ok) return session;

  return getErpUserProfile(session.data.baseUrl, session.data.sid);
}
