/** Read `sid` from ERP login Set-Cookie headers (giya-ai pattern). */
export function extractSidFromSetCookie(headers: Headers): string | null {
  const cookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter((c): c is string => Boolean(c));

  for (const cookie of cookies) {
    const match = /(?:^|[,\s])sid=([^;,\s]+)/i.exec(cookie);
    const sid = match?.[1] ? decodeURIComponent(match[1]) : null;
    if (sid && sid !== "Guest") return sid;
  }
  return null;
}
