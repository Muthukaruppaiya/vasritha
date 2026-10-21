"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  History,
  LogIn,
  LogOut,
  Printer,
  Receipt
} from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../../components/admin/admin-ui";
import { AdminPagination, useAdminPageSize } from "../../../../components/admin/admin-pagination";
import {
  ShiftHandoverReceipt,
  type ShiftHandoverReceiptData
} from "../../../../components/admin/shift-handover-receipt";
import {
  adminFetch,
  formatDate,
  formatMoney,
  getAdminUser
} from "../../../../lib/admin-api";
import type { ShiftSummary } from "../../../../lib/pos-shifts";
import { useAdminQuery } from "../../../../hooks/use-admin-query";

type ShiftRow = {
  id: string;
  shop_id: string;
  opened_by: string;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  status: "open" | "closed";
  opening_float: string | number;
  closing_cash_counted: string | number | null;
  notes: string | null;
  handover_to: string | null;
  summary: ShiftSummary | null;
  opener_name?: string | null;
  opener_code?: string | null;
  closer_name?: string | null;
  handover_name?: string | null;
};

type StaffRow = { id: string; full_name: string; email: string };

type ShiftApi = {
  shopId: string;
  myOpen: ShiftRow | null;
  shopOpen: ShiftRow | null;
  liveSummary: ShiftSummary | null;
  history: ShiftRow[];
  total: number;
  limit: number;
  offset: number;
  staff: StaffRow[];
};

export default function AdminShiftHandoverPage() {
  const sessionShopId = getAdminUser()?.shopId || null;
  const me = getAdminUser();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useAdminPageSize();
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [handoverTo, setHandoverTo] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [printData, setPrintData] = useState<ShiftHandoverReceiptData | null>(null);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    if (sessionShopId) params.set("shopId", sessionShopId);
    return `/api/admin/pos/shifts?${params.toString()}`;
  }, [page, pageSize, sessionShopId]);

  const { data, loading, error: loadError, reload } = useAdminQuery<ShiftApi>(listUrl);

  const myOpen = data?.myOpen || null;
  const shopOpen = data?.shopOpen || null;
  const live = data?.liveSummary;
  const expectedCash =
    (Number(myOpen?.opening_float) || 0) + (Number(live?.cash_total) || 0);

  const openShift = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await adminFetch<{ shift: ShiftRow }>("/api/admin/pos/shifts", {
      method: "POST",
      json: {
        action: "open",
        shopId: sessionShopId || undefined,
        openingFloat: Number(openingFloat) || 0,
        notes: notes || undefined
      }
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage("Shift opened. All POS bills will be tagged to you until handover.");
    setNotes("");
    await reload();
  };

  const printHandover = (payload: ShiftHandoverReceiptData) => {
    setPrintData(payload);
    window.setTimeout(() => {
      // Use shop-roll thermal layout (.invoice-bill--shop). Do not set
      // print-thermal — that mode hides .invoice-bill for courier slips.
      document.body.classList.add("print-shift-handover");
      window.print();
      document.body.classList.remove("print-shift-handover");
    }, 80);
  };

  const closeShift = async () => {
    if (!myOpen) return;
    const okConfirm = window.confirm(
      "Close your shift and print handover slip?\n\nSales for this session will be locked on the report."
    );
    if (!okConfirm) return;

    setBusy(true);
    setError("");
    setMessage("");
    const counted =
      closingCash.trim() === "" ? null : Math.max(0, Number(closingCash) || 0);
    const result = await adminFetch<{
      shift: ShiftRow;
      summary: ShiftSummary;
      nextShift: ShiftRow | null;
    }>("/api/admin/pos/shifts", {
      method: "POST",
      json: {
        action: "close",
        shopId: sessionShopId || undefined,
        shiftId: myOpen.id,
        closingCashCounted: counted,
        notes: notes || undefined,
        handoverTo: handoverTo || null,
        openNextForHandover: Boolean(handoverTo)
      }
    });
    setBusy(false);
    if (result.error || !result.data) {
      setError(result.error || "Could not close shift");
      return;
    }

    const summary = result.data.summary;
    const handName =
      (data?.staff || []).find((s) => s.id === handoverTo)?.full_name ||
      result.data.shift.handover_name ||
      null;

    printHandover({
      shop_name: me?.shopName || null,
      opener_name: myOpen.opener_name || me?.fullName || me?.email || "Staff",
      opener_code: myOpen.opener_code || me?.email || null,
      handover_name: handName,
      opened_at: myOpen.opened_at,
      closed_at: result.data.shift.closed_at || new Date().toISOString(),
      opening_float: Number(myOpen.opening_float) || 0,
      closing_cash_counted: counted,
      expected_cash: (Number(myOpen.opening_float) || 0) + summary.cash_total,
      summary,
      notes: notes || null
    });

    setMessage(
      handoverTo
        ? "Shift closed and handed over. Handover slip sent to printer."
        : "Shift closed. Handover slip sent to printer."
    );
    setClosingCash("");
    setHandoverTo("");
    setNotes("");
    await reload();
  };

  const reprintClosed = (row: ShiftRow) => {
    if (!row.summary || !row.closed_at) return;
    printHandover({
      shop_name: me?.shopName || null,
      opener_name: row.opener_name || "Staff",
      opener_code: row.opener_code || null,
      handover_name: row.handover_name || null,
      opened_at: row.opened_at,
      closed_at: row.closed_at,
      opening_float: Number(row.opening_float) || 0,
      closing_cash_counted:
        row.closing_cash_counted != null ? Number(row.closing_cash_counted) : null,
      expected_cash:
        (Number(row.opening_float) || 0) + (Number(row.summary.cash_total) || 0),
      summary: row.summary,
      notes: row.notes
    });
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Sales"
        title="Shift handover"
        description="Open your till, sell on POS, then close and print a thermal handover slip before the next staff starts."
        actions={
          <>
            <Link className="admin-icon-tip" href="/admin/billing">
              <Receipt size={16} strokeWidth={2} />
              <span>Store POS</span>
            </Link>
            <Link className="admin-icon-tip" href="/admin">
              <ArrowLeft size={16} strokeWidth={2} />
              <span>Dashboard</span>
            </Link>
          </>
        }
      />

      {loadError ? <AdminAlert>{loadError}</AdminAlert> : null}
      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {message ? <AdminAlert tone="ok">{message}</AdminAlert> : null}

      {loading && !data ? <AdminLoading /> : null}

      <div className="admin-grid-2">
        <AdminPanel title="Current shift">
          {myOpen ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Opened {formatDate(myOpen.opened_at)} · Float{" "}
                {formatMoney(myOpen.opening_float)}
              </p>
              <div className="inv-summary" style={{ marginBottom: 12 }}>
                <article className="inv-summary-card">
                  <div>
                    <span>Bills</span>
                    <strong>{live?.bill_count ?? 0}</strong>
                  </div>
                </article>
                <article className="inv-summary-card">
                  <div>
                    <span>Sales</span>
                    <strong>{formatMoney(live?.sales_total ?? 0)}</strong>
                  </div>
                </article>
                <article className="inv-summary-card">
                  <div>
                    <span>Cash in</span>
                    <strong>{formatMoney(live?.cash_total ?? 0)}</strong>
                  </div>
                </article>
                <article className="inv-summary-card">
                  <div>
                    <span>Expected cash</span>
                    <strong>{formatMoney(expectedCash)}</strong>
                  </div>
                </article>
              </div>

              <div className="grn-grid">
                <label>
                  <span>Cash counted now (₹)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder={String(expectedCash)}
                  />
                </label>
                <label>
                  <span>Handover to</span>
                  <select value={handoverTo} onChange={(e) => setHandoverTo(e.target.value)}>
                    <option value="">End of day (no handover)</option>
                    {(data?.staff || [])
                      .filter((s) => s.id !== me?.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} · {s.email}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="grn-span-2">
                  <span>Notes</span>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="admin-icon-tip admin-action-btn--primary"
                  disabled={busy}
                  onClick={() => void closeShift()}
                >
                  <LogOut size={16} strokeWidth={2} />
                  <span>{busy ? "Closing…" : "Close & print handover"}</span>
                </button>
                <Link className="admin-icon-tip" href="/admin/billing">
                  <Receipt size={16} strokeWidth={2} />
                  <span>Continue POS</span>
                </Link>
              </div>
            </>
          ) : (
            <>
              {shopOpen && shopOpen.opened_by !== me?.id ? (
                <AdminAlert>
                  Shift is open for {shopOpen.opener_name || "another staff"}. They must close
                  / handover before you can open.
                </AdminAlert>
              ) : (
                <p className="muted">No open shift. Open before billing so sales are tracked to you.</p>
              )}
              <div className="grn-grid">
                <label>
                  <span>Opening float (₹)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                  />
                </label>
                <label className="grn-span-2">
                  <span>Notes</span>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="admin-icon-tip admin-action-btn--primary"
                  disabled={busy || Boolean(shopOpen && shopOpen.opened_by !== me?.id)}
                  onClick={() => void openShift()}
                >
                  <LogIn size={16} strokeWidth={2} />
                  <span>{busy ? "Opening…" : "Open shift"}</span>
                </button>
              </div>
            </>
          )}
        </AdminPanel>

        <AdminPanel title="How it works">
          <ol className="muted" style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
            <li>Staff A opens shift in the morning (enter float cash).</li>
            <li>All POS bills are saved with that staff as cashier.</li>
            <li>
              Before leaving, Staff A closes shift — thermal slip shows sales total, cash, UPI,
              credit due.
            </li>
            <li>Optionally hand over to Staff B (opens their shift automatically).</li>
            <li>End of day: last staff closes without handover.</li>
          </ol>
        </AdminPanel>
      </div>

      <AdminPanel
        title="Shift history"
        actions={
          <span className="muted">
            <History size={14} style={{ display: "inline", verticalAlign: "-2px" }} /> Past
            sessions
          </span>
        }
      >
        {!loading && !(data?.history || []).length ? (
          <AdminEmpty title="No shifts yet" body="Open a shift to start tracking cashier sales." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Opened</th>
                  <th>Closed</th>
                  <th>Sales</th>
                  <th>Cash</th>
                  <th>Status</th>
                  <th>Handover</th>
                  <th className="admin-actions-col">Print</th>
                </tr>
              </thead>
              <tbody>
                {(data?.history || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.opener_name || "—"}</strong>
                      {row.opener_code ? (
                        <div className="muted admin-sub">{row.opener_code}</div>
                      ) : null}
                    </td>
                    <td>{formatDate(row.opened_at)}</td>
                    <td>{row.closed_at ? formatDate(row.closed_at) : "—"}</td>
                    <td>{formatMoney(row.summary?.sales_total ?? 0)}</td>
                    <td>{formatMoney(row.summary?.cash_total ?? 0)}</td>
                    <td>
                      <AdminBadge tone={row.status === "open" ? "warn" : "success"}>
                        {row.status}
                      </AdminBadge>
                    </td>
                    <td>{row.handover_name || "—"}</td>
                    <td className="admin-actions-col">
                      {row.status === "closed" && row.summary ? (
                        <button
                          type="button"
                          className="admin-icon-tip"
                          onClick={() => reprintClosed(row)}
                          data-tooltip="Reprint thermal"
                          aria-label="Reprint handover"
                        >
                          <Printer size={15} strokeWidth={2} />
                          <span>Print</span>
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminPagination
          page={page}
          total={data?.total || 0}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          noun="shifts"
        />
      </AdminPanel>

      {printData ? (
        <div className="print-only">
          <ShiftHandoverReceipt data={printData} />
        </div>
      ) : null}
    </>
  );
}
