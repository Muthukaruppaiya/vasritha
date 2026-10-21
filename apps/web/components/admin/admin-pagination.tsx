"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const PAGE_SIZE_STORAGE_KEY = "vasritha_admin_page_size";

function isPageSizeOption(value: number) {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

/** Rows-per-page shared across admin lists; remembered in this browser. */
export function useAdminPageSize(initial: number = DEFAULT_PAGE_SIZE) {
  const [pageSize, setPageSizeState] = useState(initial);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    if (isPageSizeOption(stored)) setPageSizeState(stored);
  }, []);

  const setPageSize = useCallback((next: number) => {
    if (!isPageSizeOption(next)) return;
    setPageSizeState(next);
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next));
  }, []);

  return [pageSize, setPageSize] as const;
}

type Props = {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
  /** When set, shows a rows-per-page selector (10 / 25 / 50 / 100). */
  onPageSizeChange?: (size: number) => void;
  /** Optional label prefix, e.g. "products" */
  noun?: string;
};

/** Shared 0-based pagination — default 10 rows per page. */
export function AdminPagination({
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  total,
  onPageChange,
  onPageSizeChange,
  noun = "rows"
}: Props) {
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const from = total === 0 ? 0 : safePage * size + 1;
  const to = Math.min((safePage + 1) * size, total);
  const showSizePicker = Boolean(onPageSizeChange) && total > PAGE_SIZE_OPTIONS[0];
  const singlePage = total <= size && safePage === 0;

  if (singlePage && !showSizePicker) {
    return total > 0 ? (
      <div className="inv-page-meta muted">
        Showing {total} {noun}
      </div>
    ) : null;
  }

  return (
    <div className="inv-pagination" role="navigation" aria-label="Pagination">
      <div className="inv-page-meta muted" style={{ margin: 0, flex: 1, textAlign: "left" }}>
        {singlePage ? `Showing ${total} ${noun}` : `Showing ${from}–${to} of ${total} ${noun}`}
      </div>
      {showSizePicker ? (
        <label className="inv-page-size">
          <span>Rows</span>
          <select
            value={size}
            onChange={(e) => {
              onPageSizeChange?.(Number(e.target.value));
              onPageChange(0);
            }}
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!singlePage ? (
        <>
          <button
            type="button"
            className="admin-icon-tip"
            disabled={safePage <= 0}
            onClick={() => onPageChange(Math.max(0, safePage - 1))}
            aria-label="Previous page"
            data-tooltip="Previous"
          >
            <ChevronLeft size={16} strokeWidth={2} />
            <span>Prev</span>
          </button>
          <span className="muted">
            {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="admin-icon-tip"
            disabled={safePage >= pageCount - 1}
            onClick={() => onPageChange(Math.min(pageCount - 1, safePage + 1))}
            aria-label="Next page"
            data-tooltip="Next"
          >
            <span>Next</span>
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </>
      ) : null}
    </div>
  );
}
