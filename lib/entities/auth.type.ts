export type AuthResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ExtensionSession = {
  email: string;
  sid: string;
  baseUrl: string;
};
