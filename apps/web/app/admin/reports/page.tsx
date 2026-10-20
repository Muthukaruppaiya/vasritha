"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { catalogForBilling, REPORT_CATALOG } from "../../../lib/report-catalog";
import { canAccessAdminPath, isAppRole, isBillingOnlyStaff } from "../../../lib/auth/rbac";
import { getAdminUser } from "../../../lib/admin-api";
import { OPS_PLATFORM_NAME } from "../../../lib/platform";

const GROUPS = ["Sales", "Purchases", "People", "Finance", "Catalogue"] as const;

export default function ReportsHubPage() {
  const roles = (getAdminUser()?.roles || []).filter(isAppRole);
  const billingOnly = isBillingOnlyStaff(roles);
  const catalog = billingOnly ? catalogForBilling() : REPORT_CATALOG;
  const showFinanceShortcuts = canAccessAdminPath(roles, "/admin/finance/pnl");

  const groups = useMemo(
    () => GROUPS.filter((group) => catalog.some((r) => r.group === group)),
    [catalog]
  );

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title={billingOnly ? "My reports" : "Reports"}
        description={
          billingOnly
            ? "Your sales, P&L, salesman totals for this login, and stock value."
            : "Detailed, filterable reports from live orders, payments, purchases, expenses and inventory."
        }
      />

      {showFinanceShortcuts ? (
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
      ) : null}

      {groups.map((group) => {
        const items = catalog.filter((r) => r.group === group);
        if (!items.length) return null;
        return (
          <AdminPanel key={group} title={group}>
            <div className="admin-card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {items.map((report) => (
                <Link
                  key={report.type}
                  className="admin-soft-card"
                  href={
                    "reuseHref" in report && report.reuseHref
                      ? report.reuseHref
                      : `/admin/reports/${report.type}`
                  }
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
