import { fetchErpFileDataUrl } from "../concern-client.ts";

const previewCache = new Map<string, string>();

function needsErpProxy(src: string): boolean {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return false;
  try {
    const url = new URL(src, "https://erp.livro.systems");
    if (url.hostname.includes("livro.systems")) return true;
    return src.includes("/private/files/") || src.startsWith("/files/");
  } catch {
    return src.includes("/private/files/");
  }
}

/** Rewrite Livro <img> srcs to session-fetched data URLs so they preview off-site. */
export async function hydrateErpImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src") || "";
      const erpSrc = img.getAttribute("data-erp-src") || src;
      if (!needsErpProxy(erpSrc)) return;

      img.setAttribute("data-erp-src", erpSrc);
      const cached = previewCache.get(erpSrc);
      if (cached) {
        img.src = cached;
        return;
      }

      img.classList.add("giya-img-loading");
      const result = await fetchErpFileDataUrl(erpSrc);
      img.classList.remove("giya-img-loading");
      if (!result.ok) {
        img.classList.add("giya-img-broken");
        return;
      }
      previewCache.set(erpSrc, result.dataUrl);
      img.src = result.dataUrl;
      img.classList.remove("giya-img-broken");
    })
  );
}
