"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../lib/i18n/provider";

type SearchHit = {
  slug: string;
  name: string;
  shortName?: string;
  type: string;
  price: string;
  imageSrc: string;
  category?: string;
  sku?: string;
  tag?: string;
};

/** App routes that are not product category slugs. */
const RESERVED_SEGMENTS = new Set([
  "products",
  "search",
  "cart",
  "checkout",
  "account",
  "login",
  "admin",
  "api",
  "collections",
  "part",
  "wishlist"
]);

function categoryFromPath(pathname: string | null) {
  if (!pathname) return null;
  const segment = (pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
  if (!segment || RESERVED_SEGMENTS.has(segment)) return null;
  return segment;
}

export function SiteSearch({ className = "" }: { className?: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const pageCategory = useMemo(() => categoryFromPath(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        mode: "card",
        limit: "12",
        q
      });
      if (pageCategory) params.set("category", pageCategory);
      fetch(`/api/products?${params.toString()}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((payload) => {
          const rows = (payload?.data || []) as SearchHit[];
          setHits(rows.slice(0, 8));
        })
        .catch(() => {
          if (!controller.signal.aborted) setHits([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query, pageCategory]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    const params = new URLSearchParams({ q });
    if (pageCategory) {
      router.push(`/${pageCategory}?${params.toString()}`);
    } else {
      router.push(`/search?${params.toString()}`);
    }
    setOpen(false);
  };

  return (
    <div className={`site-search ${className}`} ref={panelRef}>
      <button
        type="button"
        className="search-link nav-icon-btn"
        aria-label={t("common.search")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Search size={20} strokeWidth={1.65} />
      </button>

      {open ? (
        <div className="site-search-panel" role="dialog" aria-label={t("common.search")}>
          <form className="site-search-form" onSubmit={onSubmit}>
            <Search size={18} strokeWidth={1.7} aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                pageCategory
                  ? `Search in ${pageCategory.replace(/-/g, " ")}…`
                  : "Search by name, SKU, color…"
              }
              aria-label={t("common.search")}
              autoComplete="off"
            />
            <button type="button" aria-label="Close search" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </form>
          {pageCategory ? (
            <p className="site-search-scope muted">Searching this page’s category</p>
          ) : null}
          <div className="site-search-results">
            {loading ? <p className="muted">Searching…</p> : null}
            {!loading && query.trim().length >= 2 && hits.length === 0 ? (
              <p className="muted">No matches — try another word or press Enter for full results</p>
            ) : null}
            {hits.map((hit) => (
              <Link
                key={hit.slug}
                href={`/products/${hit.slug}`}
                className="site-search-hit"
                onClick={() => setOpen(false)}
              >
                <span className="site-search-hit-media">
                  {hit.imageSrc ? (
                    <Image src={hit.imageSrc} alt="" fill sizes="56px" />
                  ) : null}
                </span>
                <span className="site-search-hit-copy">
                  <small>{hit.type}</small>
                  <strong>{hit.shortName || hit.name}</strong>
                  <em>{hit.price}</em>
                </span>
              </Link>
            ))}
            {!loading && hits.length > 0 && query.trim().length >= 2 ? (
              <button
                type="button"
                className="site-search-all"
                onClick={() => {
                  const q = query.trim();
                  const params = new URLSearchParams({ q });
                  if (pageCategory) router.push(`/${pageCategory}?${params.toString()}`);
                  else router.push(`/search?${params.toString()}`);
                  setOpen(false);
                }}
              >
                View all results for “{query.trim()}”
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
