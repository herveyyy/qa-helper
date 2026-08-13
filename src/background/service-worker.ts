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
  createAssigneeConcern,
  fetchErpFileDataUrl,
  getConcernDevopsStatus,
  invalidateConcernCaches,
  listAssigneeConcerns,
  listPagePinComments,
  listPinThreadComments,
  resolveConcernForStaging,
  uploadErpFile,
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

async function handleMessage(
  message: ExtensionRequest,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  if (message.type === "PEEK_SID") {
    const hasSid = await peekSid(ERP_BASE_URL);
    return { type: "PEEK_SID", hasSid };
  }

  if (message.type === "GET_CONNECTION") {
    const connection = await peekConnection();
    return { type: "CONNECTION", ok: true, connection };
  }

  if (message.type === "CONNECT_ERP") {
    const input =
      message.tmpId && message.otp
        ? { tmp_id: message.tmpId, otp: message.otp, usr: message.usr }
        : { usr: message.usr || "", pwd: message.pwd || "" };
    const result = await connectErp(input);
    if (!result.ok) {
      return { type: "CONNECT_ERP", ok: false, error: result.error };
    }
    if ("needsOtp" in result.data && result.data.needsOtp) {
      return {
        type: "CONNECT_ERP",
        ok: true,
        needsOtp: true,
        tmpId: result.data.tmpId,
        prompt: result.data.prompt,
        method: result.data.method,
      };
    }
    return {
      type: "CONNECT_ERP",
      ok: true,
      connection: result.data.connection,
    };
  }

  if (message.type === "CONNECT_ERP_DESK") {
    const result = await connectErpFromDesk(ERP_BASE_URL);
    if (!result.ok) {
      return { type: "CONNECT_ERP", ok: false, error: result.error };
    }
    return { type: "CONNECT_ERP", ok: true, connection: result.data };
  }

  if (message.type === "DISCONNECT_ERP") {
    await disconnectErp();
    return { type: "DISCONNECTED" };
  }

  if (message.type === "GET_SESSION") {
    const result = await getSession(ERP_BASE_URL, { force: Boolean(message.force) });
    return result.ok
      ? { type: "SESSION", ok: true, session: result.data }
      : { type: "SESSION", ok: false, error: result.error };
  }

  if (message.type === "GET_USER_PROFILE") {
    const result = await getUserProfile(ERP_BASE_URL);
    return result.ok
      ? { type: "USER_PROFILE", ok: true, profile: result.data }
      : { type: "USER_PROFILE", ok: false, error: result.error };
  }

  if (message.type === "LIST_CONCERNS") {
    const result = await listAssigneeConcerns(ERP_BASE_URL, {
      force: Boolean(message.force),
    });
    return result.ok
      ? { type: "CONCERNS", ok: true, concerns: result.data }
      : { type: "CONCERNS", ok: false, error: result.error };
  }

  if (message.type === "CREATE_CONCERN") {
    const result = await createAssigneeConcern(
      {
        subject: message.subject,
        type: message.concernType,
        priority: message.priority,
        description: message.description,
      },
      ERP_BASE_URL
    );
    return result.ok
      ? { type: "CONCERN_CREATED", ok: true, concern: result.data }
      : { type: "CONCERN_CREATED", ok: false, error: result.error };
  }

  if (message.type === "LIST_PAGE_PINS") {
    const result = await listPagePinComments(message.href, ERP_BASE_URL);
    return result.ok
      ? { type: "PAGE_PINS", ok: true, pins: result.data }
      : { type: "PAGE_PINS", ok: false, error: result.error };
  }

  if (message.type === "ADD_CONCERN_PIN") {
    const result = await addConcernPinComment(
      message.concernName,
      message.pin,
      ERP_BASE_URL
    );
    return result.ok
      ? { type: "PIN_SAVED", ok: true, commentName: result.data.commentName }
      : { type: "PIN_SAVED", ok: false, error: result.error };
  }

  if (message.type === "LIST_PIN_THREAD") {
    const result = await listPinThreadComments(
      message.concernName,
      message.threadId,
      ERP_BASE_URL
    );
    return result.ok
      ? { type: "PIN_THREAD", ok: true, comments: result.data }
      : { type: "PIN_THREAD", ok: false, error: result.error };
  }

  if (message.type === "GET_CONCERN_DEVOPS") {
    const result = await getConcernDevopsStatus(message.concernName, ERP_BASE_URL);
    return result.ok
      ? {
          type: "CONCERN_DEVOPS",
          ok: true,
          devopsStatus: result.data.devopsStatus,
          resolved: result.data.resolved,
        }
      : { type: "CONCERN_DEVOPS", ok: false, error: result.error };
  }

  if (message.type === "RESOLVE_CONCERN") {
    const result = await resolveConcernForStaging(
      message.concernName,
      ERP_BASE_URL
    );
    return result.ok
      ? {
          type: "CONCERN_DEVOPS",
          ok: true,
          devopsStatus: result.data.devopsStatus,
          resolved: result.data.resolved,
        }
      : { type: "CONCERN_DEVOPS", ok: false, error: result.error };
  }

  if (message.type === "UPLOAD_ERP_FILE") {
    const result = await uploadErpFile(
      {
        filename: message.filename,
        mimeType: message.mimeType,
        base64: message.base64,
        doctype: message.doctype,
        docname: message.docname,
        isPrivate: message.isPrivate,
      },
      ERP_BASE_URL
    );
    return result.ok
      ? {
          type: "ERP_FILE",
          ok: true,
          fileUrl: result.data.fileUrl,
          fileName: result.data.fileName,
        }
      : { type: "ERP_FILE", ok: false, error: result.error };
  }

  if (message.type === "FETCH_ERP_FILE_DATA") {
    const result = await fetchErpFileDataUrl(message.url, ERP_BASE_URL);
    return result.ok
      ? {
          type: "ERP_FILE_DATA",
          ok: true,
          dataUrl: result.data.dataUrl,
          mimeType: result.data.mimeType,
        }
      : { type: "ERP_FILE_DATA", ok: false, error: result.error };
  }

  if (message.type === "CAPTURE_VISIBLE_TAB") {
    const windowId = sender.tab?.windowId;
    if (windowId == null) {
      return { type: "TAB_CAPTURE", ok: false, error: "No active tab to capture." };
    }
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: "png",
      });
      if (!dataUrl) {
        return { type: "TAB_CAPTURE", ok: false, error: "Capture returned empty." };
      }
      return { type: "TAB_CAPTURE", ok: true, dataUrl };
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Screenshot capture failed.";
      return { type: "TAB_CAPTURE", ok: false, error: text };
    }
  }

  if (message.type === "OPEN_LOGIN_PAGE") {
    openExtensionLoginPage();
    return { type: "OPENED_LOGIN" };
  }

  if (message.type === "OPEN_USER_PAGE") {
    const result = await getSession(ERP_BASE_URL);
    if (!result.ok) {
      openExtensionLoginPage();
      return { type: "OPENED_LOGIN" };
    }
    openUserPage();
    return { type: "OPENED_USER" };
  }

  if (message.type === "OPEN_LIVRO_LOGIN") {
    openLivroLogin(ERP_BASE_URL);
    return { type: "OPENED_LOGIN" };
  }

  return { type: "SESSION", ok: false, error: "Unknown message." };
}

chrome.runtime.onMessage.addListener((message: ExtensionRequest, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then((response) => {
      try {
        sendResponse(response);
      } catch {
        // Channel already closed (tab navigated / extension reloaded).
      }
    })
    .catch((error: unknown) => {
      const text = error instanceof Error ? error.message : "Background handler failed.";
      try {
        sendResponse({ type: "SESSION", ok: false, error: text } satisfies ExtensionResponse);
      } catch {
        // Channel already closed.
      }
    });

  return true;
});

chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cookie.name !== "sid") return;
  if (!changeInfo.cookie.domain.includes("livro.systems")) return;

  // Ignore sid overwrites (Connect / ensure cookie) — those caused fetch storms.
  // Only react when the session cookie is actually cleared (logout / expiry).
  if (!changeInfo.removed) return;

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
