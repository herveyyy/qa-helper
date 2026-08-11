import type { UserProfile, UserResult } from "../../entities/user.type";
import { ERP_BASE_URL } from "../../entities/erpnext.type";
import { getUserProfile as getUserProfileUseCase } from "../usecases/user/get_user_profile.usecase";

export async function getUserProfile(
  baseUrl: string = ERP_BASE_URL
): Promise<UserResult<UserProfile>> {
  return getUserProfileUseCase(baseUrl);
}

export function openUserPage(): void {
  void chrome.tabs.create({ url: chrome.runtime.getURL("pages/user.html") });
}
