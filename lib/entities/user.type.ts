export type UserProfile = {
  /** User.name — usually the email */
  userName: string;
  email: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  /** Absolute image URL when available */
  userImage: string | null;
  userPath: string;
};

export type UserResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
