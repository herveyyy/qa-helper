import type {
  Concern,
  GiyaPinComment,
  GiyaPinPayload,
} from "../../lib/entities/concern.type";
import type { ExtensionSession } from "../../lib/entities/auth.type";
import type { GiyaErpConnection } from "../../lib/entities/giya_connection.type";
import type { UserProfile } from "../../lib/entities/user.type";

export type ExtensionRequest =
  | { type: "GET_SESSION"; force?: boolean }
  | { type: "PEEK_SID" }
  | { type: "GET_CONNECTION" }
  | {
      type: "CONNECT_ERP";
      usr?: string;
      pwd?: string;
      tmpId?: string;
      otp?: string;
    }
  | { type: "CONNECT_ERP_DESK" }
  | { type: "DISCONNECT_ERP" }
  | { type: "GET_USER_PROFILE" }
  | { type: "LIST_CONCERNS"; force?: boolean }
  | {
      type: "CREATE_CONCERN";
      subject: string;
      concernType?: string;
      priority?: string;
      description?: string;
    }
  | { type: "LIST_PAGE_PINS"; href: string }
  | { type: "ADD_CONCERN_PIN"; concernName: string; pin: GiyaPinPayload }
  | { type: "LIST_PIN_THREAD"; concernName: string; threadId: string }
  | { type: "GET_CONCERN_DEVOPS"; concernName: string }
  | { type: "RESOLVE_CONCERN"; concernName: string }
  | {
      type: "UPLOAD_ERP_FILE";
      filename: string;
      mimeType: string;
      base64: string;
      doctype?: string;
      docname?: string;
      isPrivate?: boolean;
    }
  | { type: "FETCH_ERP_FILE_DATA"; url: string }
  | { type: "CAPTURE_VISIBLE_TAB" }
  | { type: "OPEN_LOGIN_PAGE" }
  | { type: "OPEN_USER_PAGE" }
  | { type: "OPEN_LIVRO_LOGIN" };

export type ExtensionResponse =
  | { type: "SESSION"; ok: true; session: ExtensionSession }
  | { type: "SESSION"; ok: false; error: string }
  | { type: "PEEK_SID"; hasSid: boolean }
  | { type: "CONNECTION"; ok: true; connection: GiyaErpConnection | null }
  | {
      type: "CONNECT_ERP";
      ok: true;
      needsOtp?: false;
      connection: GiyaErpConnection;
    }
  | {
      type: "CONNECT_ERP";
      ok: true;
      needsOtp: true;
      tmpId: string;
      prompt: string;
      method: string;
    }
  | { type: "CONNECT_ERP"; ok: false; error: string }
  | { type: "DISCONNECTED" }
  | { type: "USER_PROFILE"; ok: true; profile: UserProfile }
  | { type: "USER_PROFILE"; ok: false; error: string }
  | { type: "CONCERNS"; ok: true; concerns: Concern[] }
  | { type: "CONCERNS"; ok: false; error: string }
  | { type: "CONCERN_CREATED"; ok: true; concern: Concern }
  | { type: "CONCERN_CREATED"; ok: false; error: string }
  | { type: "PAGE_PINS"; ok: true; pins: GiyaPinComment[] }
  | { type: "PAGE_PINS"; ok: false; error: string }
  | { type: "PIN_SAVED"; ok: true; commentName: string }
  | { type: "PIN_SAVED"; ok: false; error: string }
  | { type: "PIN_THREAD"; ok: true; comments: GiyaPinComment[] }
  | { type: "PIN_THREAD"; ok: false; error: string }
  | {
      type: "CONCERN_DEVOPS";
      ok: true;
      devopsStatus: string;
      resolved: boolean;
    }
  | { type: "CONCERN_DEVOPS"; ok: false; error: string }
  | { type: "ERP_FILE"; ok: true; fileUrl: string; fileName: string }
  | { type: "ERP_FILE"; ok: false; error: string }
  | { type: "ERP_FILE_DATA"; ok: true; dataUrl: string; mimeType: string }
  | { type: "ERP_FILE_DATA"; ok: false; error: string }
  | { type: "TAB_CAPTURE"; ok: true; dataUrl: string }
  | { type: "TAB_CAPTURE"; ok: false; error: string }
  | { type: "OPENED_LOGIN" }
  | { type: "OPENED_USER" };
