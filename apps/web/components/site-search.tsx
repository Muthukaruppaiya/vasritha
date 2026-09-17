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

const CATEGORY_SLUGS = new Set([
  "sarees",
  "jewelry",
  "jewellery",
  "churidhars-salwars",
  "handcrafted",
  "collections"
]);

function categoryFromPath(pathname: string | null) {
  if (!pathname) return null;
  const segment = pathname.split("/").filter(Boolean)[0] || "";
  if (!segment || segment === "products" || segment === "search") return null;
  if (segment === "collections") return null;
  return CATEGORY_SLUGS.has(segment) ? segment : null;
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
        limit: "48",
        q
      });
      if (pageCategory) params.set("category", pageCategory);
      fetch(`/api/products?${params.toString()}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((payload) => {
          const rows = (payload?.data || []) as SearchHit[];
          const needle = q.toLowerCase();
          setHits(
            rows
              .filter((row) => {
                const hay = [
                  row.name,
                  row.shortName,
                  row.type,
                  row.sku,
                  row.tag,
                  row.slug
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                return hay.includes(needle);
              })
              .slice(0, 8)
          );
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
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
                  : "Search products…"
              }
              aria-label={t("common.search")}
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
              <p className="muted">No matches</p>
            ) : null}
            {hits.map((hit) => (
              <Link
                key={hit.slug}
                href={`/products/${hit.slug}`}
                className="site-search-hit"
                onClick={() => setOpen(false)}
              >
                <span className="site-search-hit-media">
                  <Image src={hit.imageSrc} alt="" fill sizes="56px" />
                </span>
                <span className="site-search-hit-copy">
                  <small>{hit.type}</small>
                  <strong>{hit.shortName || hit.name}</strong>
                  <em>{hit.price}</em>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
