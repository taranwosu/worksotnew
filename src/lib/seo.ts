import { useEffect } from "react";

const DEFAULTS = {
  siteName: "WorkSoy",
  defaultTitle: "WorkSoy — Premium contractors. Real accountability.",
  defaultDescription:
    "WorkSoy — the premium network for vetted contractors, fractional leaders, and senior specialists. Brief in, shortlist in 48 hours, contract signed by Friday.",
  origin: "https://worksoy.com",
};

export type PageMeta = {
  title: string;
  description?: string;
  /** Path for canonical URL — defaults to current location.pathname */
  path?: string;
  /** "noindex" for auth/dashboard surfaces. Defaults to "index,follow". */
  robots?: string;
  /** Override og:image (absolute URL). */
  image?: string;
};

/**
 * Imperatively keep <title>, meta description, canonical, and Open Graph tags
 * in sync with the active route. Cleans up on unmount so SPA navigation
 * doesn't leak per-page values back to defaults.
 */
export function usePageMeta(meta: PageMeta): void {
  useEffect(() => {
    const previousTitle = document.title;
    const fullTitle =
      meta.title.includes(DEFAULTS.siteName)
        ? meta.title
        : `${meta.title} · ${DEFAULTS.siteName}`;
    document.title = fullTitle;

    const description = meta.description ?? DEFAULTS.defaultDescription;
    const robots = meta.robots ?? "index,follow";
    const path =
      meta.path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    const canonical = `${DEFAULTS.origin}${path}`;

    const created: HTMLElement[] = [];

    setMeta(created, "name", "description", description);
    setMeta(created, "name", "robots", robots);
    setLink(created, "canonical", canonical);

    setMeta(created, "property", "og:type", "website");
    setMeta(created, "property", "og:site_name", DEFAULTS.siteName);
    setMeta(created, "property", "og:title", fullTitle);
    setMeta(created, "property", "og:description", description);
    setMeta(created, "property", "og:url", canonical);
    if (meta.image) setMeta(created, "property", "og:image", meta.image);

    setMeta(created, "name", "twitter:card", "summary_large_image");
    setMeta(created, "name", "twitter:title", fullTitle);
    setMeta(created, "name", "twitter:description", description);
    if (meta.image) setMeta(created, "name", "twitter:image", meta.image);

    return () => {
      document.title = previousTitle;
      // Only remove the tags we created so we don't strip static index.html ones.
      for (const el of created) el.remove();
    };
  }, [meta.title, meta.description, meta.path, meta.robots, meta.image]);
}

function setMeta(
  created: HTMLElement[],
  attr: "name" | "property",
  key: string,
  value: string,
): void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
    created.push(el);
  }
  el.setAttribute("content", value);
}

function setLink(created: HTMLElement[], rel: string, href: string): void {
  const selector = `link[rel="${rel}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
    created.push(el);
  }
  el.setAttribute("href", href);
}
