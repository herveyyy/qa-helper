import type {
  Concern,
  ConcernResult,
  GiyaPinComment,
  GiyaPinPayload,
} from "../../entities/concern.type";
import { ERP_BASE_URL } from "../../entities/erpnext.type";
import { getExtensionSession } from "../usecases/auth/get_extension_session.usecase";
import {
  createAssigneeConcern as createAssigneeConcernUseCase,
  type CreateConcernInput,
} from "../usecases/concern/create_assignee_concern.usecase";
import { addConcernPinComment as addConcernPinCommentUseCase } from "../usecases/concern/add_concern_pin_comment.usecase";
import { listAssigneeConcerns as listAssigneeConcernsUseCase } from "../usecases/concern/list_assignee_concerns.usecase";
import { listPagePinComments as listPagePinCommentsUseCase } from "../usecases/concern/list_page_pin_comments.usecase";

const CONCERNS_TTL_MS = 60_000;
const PINS_TTL_MS = 30_000;

type CacheEntry<T> = { at: number; data: T };

let concernsCache: CacheEntry<Concern[]> | null = null;
let concernsCacheEmail: string | null = null;
const pinsCache = new Map<string, CacheEntry<GiyaPinComment[]>>();

function pageKey(email: string, href: string): string {
  try {
    const url = new URL(href);
    return `${email}|${url.origin}${url.pathname}`;
  } catch {
    return `${email}|${href.split("#")[0]}`;
  }
}

export function invalidateConcernCaches(): void {
  concernsCache = null;
  concernsCacheEmail = null;
  pinsCache.clear();
}

export async function listAssigneeConcerns(
  baseUrl: string = ERP_BASE_URL,
  options: { force?: boolean } = {}
): Promise<ConcernResult<Concern[]>> {
  const session = await getExtensionSession(baseUrl);
  if (!session.ok) return session;

  const email = session.data.email;
  if (
    !options.force &&
    concernsCache &&
    concernsCacheEmail === email &&
    Date.now() - concernsCache.at < CONCERNS_TTL_MS
  ) {
    return { ok: true, data: concernsCache.data };
  }

  const result = await listAssigneeConcernsUseCase(baseUrl);
  if (result.ok) {
    concernsCache = { at: Date.now(), data: result.data };
    concernsCacheEmail = email;
  }
  return result;
}

export async function createAssigneeConcern(
  input: CreateConcernInput,
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<Concern>> {
  const result = await createAssigneeConcernUseCase(input, baseUrl);
  if (result.ok) invalidateConcernCaches();
  return result;
}

export async function addConcernPinComment(
  concernName: string,
  pin: GiyaPinPayload,
  baseUrl: string = ERP_BASE_URL
): Promise<ConcernResult<{ commentName: string }>> {
  const result = await addConcernPinCommentUseCase(concernName, pin, baseUrl);
  if (result.ok) invalidateConcernCaches();
  return result;
}

export async function listPagePinComments(
  pageHref: string,
  baseUrl: string = ERP_BASE_URL,
  options: { force?: boolean } = {}
): Promise<ConcernResult<GiyaPinComment[]>> {
  const session = await getExtensionSession(baseUrl);
  if (!session.ok) return session;

  const key = pageKey(session.data.email, pageHref);
  const hit = pinsCache.get(key);
  if (!options.force && hit && Date.now() - hit.at < PINS_TTL_MS) {
    return { ok: true, data: hit.data };
  }

  // Reuse concerns cache so pins don't cold-fetch Sprint Backlogs again.
  const concerns = await listAssigneeConcerns(baseUrl);
  if (!concerns.ok) return concerns;

  const result = await listPagePinCommentsUseCase(pageHref, baseUrl, {
    concernNames: concerns.data.map((c) => c.name),
    concernSubjects: new Map(concerns.data.map((c) => [c.name, c.subject])),
  });

  if (result.ok) {
    pinsCache.set(key, { at: Date.now(), data: result.data });
  }
  return result;
}
