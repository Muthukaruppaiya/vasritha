"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_PAGE_SIZE = 10;

type Props = {
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Optional label prefix, e.g. "products" */
  noun?: string;
};

/** Shared 0-based pagination — default 10 rows per page. */
export function AdminPagination({
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  total,
  onPageChange,
  noun = "rows"
}: Props) {
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const from = total === 0 ? 0 : safePage * size + 1;
  const to = Math.min((safePage + 1) * size, total);

  if (total <= size && safePage === 0) {
    return total > 0 ? (
      <div className="inv-page-meta muted">
        Showing {total} {noun}
      </div>
    ) : null;
  }

  return (
    <div className="inv-pagination" role="navigation" aria-label="Pagination">
      <div className="inv-page-meta muted" style={{ margin: 0, flex: 1, textAlign: "left" }}>
        Showing {from}–{to} of {total} {noun}
      </div>
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
    </div>
  );
}
