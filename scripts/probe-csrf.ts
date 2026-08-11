const site = "https://erp.livro.systems";
const urls = ["/app", "/api/method/frappe.auth.get_logged_user", "/login"];

for (const path of urls) {
  const res = await fetch(`${site}${path}`, {
    redirect: "manual",
    headers: { Accept: "text/html,application/json" },
  });
  const setCookie =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie")];
  const text = await res.text();
  const csrf =
    text.match(/csrf_token["'\s:=]+([a-f0-9]{10,})/i)?.[1] ||
    text.match(/"csrf_token"\s*:\s*"([^"]+)"/)?.[1] ||
    null;
  console.log({
    path,
    status: res.status,
    csrfInBody: csrf,
    setCookie: setCookie?.filter(Boolean).slice(0, 3),
    bodyStart: text.slice(0, 180).replace(/\s+/g, " "),
  });
}
