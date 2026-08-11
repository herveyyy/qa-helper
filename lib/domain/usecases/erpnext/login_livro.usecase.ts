import type { AuthResult } from "../../../entities/auth.type";
import { ERP_BASE_URL, normalizeErpBaseUrl } from "../../../entities/erpnext.type";
import { ensureErpSidCookie } from "../auth/ensure_erp_sid_cookie.usecase";
import { extractSidFromSetCookie } from "./extract_sid.usecase";

export type LivroLoginInput =
  | { usr: string; pwd: string; baseUrl?: string }
  | { tmp_id: string; otp: string; usr?: string; baseUrl?: string };

export type LivroLoginNeedsOtp = {
  needsOtp: true;
  tmpId: string;
  prompt: string;
  method: string;
};

export type LivroLoginSuccess = {
  needsOtp?: false;
  sid: string;
  fullName: string;
  baseUrl: string;
  email: string;
};

type ErpLoginBody = {
  full_name?: string;
  message?: string;
  tmp_id?: string;
  verification?: {
    token_delivery?: boolean;
    prompt?: string;
    method?: string;
  };
};

async function readErpJson(response: Response): Promise<ErpLoginBody | null> {
  const text = await response.text();
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) return null;
  try {
    return JSON.parse(trimmed) as ErpLoginBody;
  } catch {
    return null;
  }
}

async function postErpLogin(
  baseUrl: string,
  body: Record<string, string>,
  contentType: "json" | "form"
): Promise<{ response: Response; erpBody: ErpLoginBody | null }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let payload: string;
  if (contentType === "form") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(body).toString();
  } else {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("ERP_TIMEOUT"), 12_000);
  try {
    const response = await fetch(`${baseUrl}/api/method/login`, {
      method: "POST",
      headers,
      body: payload,
      redirect: "manual",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    return { response, erpBody: await readErpJson(response) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Password/OTP login against Livro ERP (giya-ai `loginLivroErp`).
 * Sets browser cookies for erp.livro.systems via Set-Cookie + credentials.
 */
export async function loginLivroErp(
  input: LivroLoginInput
): Promise<AuthResult<LivroLoginNeedsOtp | LivroLoginSuccess>> {
  const baseUrl = normalizeErpBaseUrl(input.baseUrl || ERP_BASE_URL);
  if (!baseUrl) return { ok: false, error: "ERP URL is not configured." };

  try {
    let body: Record<string, string>;
    let emailHint = "";
    if ("tmp_id" in input) {
      if (!input.tmp_id || !input.otp) {
        return { ok: false, error: "Verification code is required." };
      }
      body = { cmd: "login", tmp_id: input.tmp_id, otp: input.otp };
      emailHint = input.usr?.trim() || "";
    } else {
      const usr = input.usr.trim();
      if (!usr || !input.pwd) {
        return { ok: false, error: "Email and password are required." };
      }
      body = { usr, pwd: input.pwd };
      emailHint = usr;
    }

    let { response, erpBody } = await postErpLogin(baseUrl, body, "form");
    if (!erpBody && (response.status === 404 || response.status === 405 || response.status >= 500)) {
      ({ response, erpBody } = await postErpLogin(baseUrl, body, "json"));
    }

    if (erpBody?.tmp_id) {
      return {
        ok: true,
        data: {
          needsOtp: true,
          tmpId: erpBody.tmp_id,
          prompt:
            erpBody.verification?.prompt ??
            "Enter the verification code sent to your email.",
          method: erpBody.verification?.method ?? "Email",
        },
      };
    }

    let sid = extractSidFromSetCookie(response.headers);
    // SW fetch sometimes hides Set-Cookie; credentials:include may still have applied it.
    if (!sid) {
      try {
        const existing = await chrome.cookies.get({ url: baseUrl, name: "sid" });
        const value = existing?.value?.trim() ?? "";
        if (value && value !== "Guest") sid = value;
      } catch {
        // ignore
      }
    }

    const looksLoggedIn =
      Boolean(erpBody?.full_name) ||
      (typeof erpBody?.message === "string" &&
        /logged\s*in/i.test(erpBody.message));

    if (!sid) {
      const msg =
        typeof erpBody?.message === "string" && erpBody.message && !looksLoggedIn
          ? erpBody.message
          : "Login succeeded but SID cookie was not set. Retry Connect.";
      return { ok: false, error: msg };
    }

    const fullName = erpBody?.full_name?.trim() || emailHint || "User";
    const email = emailHint || "livro-user";
    await ensureErpSidCookie(baseUrl, sid, { userId: email, fullName });

    return {
      ok: true,
      data: {
        sid,
        fullName,
        baseUrl,
        email,
      },
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return { ok: false, error: `ERP at ${baseUrl} timed out.` };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "ERPNext login failed.",
    };
  }
}
