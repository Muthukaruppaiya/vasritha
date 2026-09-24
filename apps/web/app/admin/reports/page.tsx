"use client";

import Link from "next/link";
import {
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { REPORT_CATALOG } from "../../../lib/report-catalog";
import { OPS_PLATFORM_NAME } from "../../../lib/platform";

const GROUPS = ["Sales", "Purchases", "People", "Finance", "Catalogue"] as const;

export default function ReportsHubPage() {
  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Reports"
        description="Detailed, filterable reports from live orders, payments, purchases, expenses and inventory. Profit and outstanding dues reuse Finance — they are not recalculated here."
      />

      <div className="admin-card-grid">
        <Link className="admin-soft-card" href="/admin/finance/pnl">
          <strong>Profit &amp; Loss</strong>
          <p className="muted">Full boutique P&amp;L (Finance module).</p>
        </Link>
        <Link className="admin-soft-card" href="/admin/finance/receivables">
          <strong>Customer dues</strong>
          <p className="muted">Ageing receivables in Finance.</p>
        </Link>
        <Link className="admin-soft-card" href="/admin/finance/payables">
          <strong>Supplier dues</strong>
          <p className="muted">Open purchase bills in Finance.</p>
        </Link>
        <Link className="admin-soft-card" href="/admin">
          <strong>Dashboard</strong>
          <p className="muted">Period KPIs and charts.</p>
        </Link>
      </div>

      {GROUPS.map((group) => {
        const items = REPORT_CATALOG.filter((r) => r.group === group);
        if (!items.length) return null;
        return (
          <AdminPanel key={group} title={group}>
            <div className="admin-card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {items.map((report) => (
                <Link
                  key={report.type}
                  className="admin-soft-card"
                  href={`/admin/reports/${report.type}`}
                >
                  <strong>{report.label}</strong>
                  <p className="muted">{report.description}</p>
                </Link>
              ))}
            </div>
          </AdminPanel>
        );
      })}
    </div>
  );
}
