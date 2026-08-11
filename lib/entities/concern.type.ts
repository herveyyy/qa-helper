/** Livro “Concern” = Sprint Backlogs (SPB). */
export type Concern = {
  name: string;
  subject: string;
  status: string;
  type: string;
  priority: string;
  sprintAssign: string | null;
  devAssignee: string | null;
  currentAssignee: string | null;
};

export type GiyaPinEnvSpec = {
  label: string;
  value: string;
};

export type GiyaPinPayload = {
  v: 1;
  href: string;
  selector: string;
  label: string;
  tagName: string;
  /** Frappe Comment HTML (sanitized); may include <img> from Livro uploads. */
  text: string;
  /** Browser / page specs captured when the comment was posted. */
  envSpecs?: GiyaPinEnvSpec[];
};

export type GiyaPinComment = {
  commentName: string;
  concernName: string;
  concernSubject: string;
  commentBy: string;
  commentEmail: string;
  creation: string;
  pin: GiyaPinPayload;
};

export type ConcernResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
