import {
  connectErp,
  connectErpFromDesk,
  disconnectErp,
  getSession,
  invalidateSessionCache,
  openExtensionLoginPage,
  openLivroLogin,
  peekConnection,
  peekSid,
} from "../../lib/domain/services/auth.service";
import {
  addConcernPinComment,
  invalidateConcernCaches,
  listAssigneeConcerns,
  listPagePinComments,
} from "../../lib/domain/services/concern.service";
import { getUserProfile, openUserPage } from "../../lib/domain/services/user.service";
import { ERP_BASE_URL } from "../../lib/entities/erpnext.type";
import { STORAGE_DEFAULTS } from "../shared/defaults.ts";
import type { ExtensionRequest, ExtensionResponse } from "../shared/messages.ts";

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const current = await chrome.storage.sync.get(Object.keys(STORAGE_DEFAULTS));
    const toSet: Partial<typeof STORAGE_DEFAULTS> = {};

    for (const [key, value] of Object.entries(STORAGE_DEFAULTS)) {
      const typedKey = key as keyof typeof STORAGE_DEFAULTS;
      if (current[typedKey] === undefined) {
        toSet[typedKey] = value as never;
      }
    }

    if (Object.keys(toSet).length > 0) {
      await chrome.storage.sync.set(toSet);
    }
  })();
});

chrome.runtime.onMessage.addListener((message: ExtensionRequest, _sender, sendResponse) => {
  void (async () => {
    if (message.type === "PEEK_SID") {
      const hasSid = await peekSid(ERP_BASE_URL);
      sendResponse({ type: "PEEK_SID", hasSid } satisfies ExtensionResponse);
      return;
    }

    if (message.type === "GET_CONNECTION") {
      const connection = await peekConnection();
      sendResponse({ type: "CONNECTION", ok: true, connection } satisfies ExtensionResponse);
      return;
    }

    if (message.type === "CONNECT_ERP") {
      const input =
        message.tmpId && message.otp
          ? { tmp_id: message.tmpId, otp: message.otp, usr: message.usr }
          : { usr: message.usr || "", pwd: message.pwd || "" };
      const result = await connectErp(input);
      if (!result.ok) {
        sendResponse({
          type: "CONNECT_ERP",
          ok: false,
          error: result.error,
        } satisfies ExtensionResponse);
        return;
      }
      if ("needsOtp" in result.data && result.data.needsOtp) {
        sendResponse({
          type: "CONNECT_ERP",
          ok: true,
          needsOtp: true,
          tmpId: result.data.tmpId,
          prompt: result.data.prompt,
          method: result.data.method,
        } satisfies ExtensionResponse);
        return;
      }
      sendResponse({
        type: "CONNECT_ERP",
        ok: true,
        connection: result.data.connection,
      } satisfies ExtensionResponse);
      return;
    }

    if (message.type === "CONNECT_ERP_DESK") {
      const result = await connectErpFromDesk(ERP_BASE_URL);
      if (!result.ok) {
        sendResponse({
          type: "CONNECT_ERP",
          ok: false,
          error: result.error,
        } satisfies ExtensionResponse);
        return;
      }
      sendResponse({
        type: "CONNECT_ERP",
        ok: true,
        connection: result.data,
      } satisfies ExtensionResponse);
      return;
    }

    if (message.type === "DISCONNECT_ERP") {
      await disconnectErp();
      sendResponse({ type: "DISCONNECTED" } satisfies ExtensionResponse);
      return;
    }

    if (message.type === "GET_SESSION") {
      const result = await getSession(ERP_BASE_URL, { force: Boolean(message.force) });
      const response: ExtensionResponse = result.ok
        ? { type: "SESSION", ok: true, session: result.data }
        : { type: "SESSION", ok: false, error: result.error };
      sendResponse(response);
      return;
    }

    if (message.type === "GET_USER_PROFILE") {
      const result = await getUserProfile(ERP_BASE_URL);
      const response: ExtensionResponse = result.ok
        ? { type: "USER_PROFILE", ok: true, profile: result.data }
        : { type: "USER_PROFILE", ok: false, error: result.error };
      sendResponse(response);
      return;
    }

    if (message.type === "LIST_CONCERNS") {
      const result = await listAssigneeConcerns(ERP_BASE_URL);
      const response: ExtensionResponse = result.ok
        ? { type: "CONCERNS", ok: true, concerns: result.data }
        : { type: "CONCERNS", ok: false, error: result.error };
      sendResponse(response);
      return;
    }

    if (message.type === "LIST_PAGE_PINS") {
      const result = await listPagePinComments(message.href, ERP_BASE_URL);
      const response: ExtensionResponse = result.ok
        ? { type: "PAGE_PINS", ok: true, pins: result.data }
        : { type: "PAGE_PINS", ok: false, error: result.error };
      sendResponse(response);
      return;
    }

    if (message.type === "ADD_CONCERN_PIN") {
      const result = await addConcernPinComment(
        message.concernName,
        message.pin,
        ERP_BASE_URL
      );
      const response: ExtensionResponse = result.ok
        ? { type: "PIN_SAVED", ok: true, commentName: result.data.commentName }
        : { type: "PIN_SAVED", ok: false, error: result.error };
      sendResponse(response);
      return;
    }

    if (message.type === "OPEN_LOGIN_PAGE") {
      openExtensionLoginPage();
      sendResponse({ type: "OPENED_LOGIN" } satisfies ExtensionResponse);
      return;
    }

    if (message.type === "OPEN_USER_PAGE") {
      const result = await getSession(ERP_BASE_URL);
      if (!result.ok) {
        openExtensionLoginPage();
        sendResponse({ type: "OPENED_LOGIN" } satisfies ExtensionResponse);
        return;
      }
      openUserPage();
      sendResponse({ type: "OPENED_USER" } satisfies ExtensionResponse);
      return;
    }

    if (message.type === "OPEN_LIVRO_LOGIN") {
      openLivroLogin(ERP_BASE_URL);
      sendResponse({ type: "OPENED_LOGIN" } satisfies ExtensionResponse);
    }
  })();

  return true;
});

chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cookie.name !== "sid") return;
  if (!changeInfo.cookie.domain.includes("livro.systems")) return;

  invalidateSessionCache();
  invalidateConcernCaches();

  void chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id == null) continue;
      void chrome.tabs.sendMessage(tab.id, { type: "AUTH_CHANGED" }).catch(() => {
        // Tab may not have the content script.
      });
    }
  });
});

chrome.action.onClicked.addListener(() => {
  void (async () => {
    const result = await getSession(ERP_BASE_URL);
    if (!result.ok) {
      openExtensionLoginPage();
      return;
    }
    openUserPage();
  })();
});
