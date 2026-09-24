"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, History } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../components/admin/admin-ui";
import { formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";
import { OPS_PLATFORM_NAME } from "../../../lib/platform";

type LoginEventRow = {
  id: string;
  email_attempted: string;
  success: boolean;
  failure_code: string | null;
  client: string;
  ip: string | null;
  device_label: string | null;
  full_name: string | null;
  user_email: string | null;
  created_at: string;
  roles_snapshot: string[] | null;
};

type LoginLogPayload = {
  rows: LoginEventRow[];
  stats: {
    total_24h: number;
    success_24h: number;
    failed_24h: number;
    staff_24h: number;
  };
};

export default function LoginLogPage() {
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [client, setClient] = useState("all");
  const [success, setSuccess] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const path = useMemo(() => {
    const params = new URLSearchParams({ limit: "200" });
    if (submittedQ) params.set("q", submittedQ);
    if (client !== "all") params.set("client", client);
    if (success !== "all") params.set("success", success);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/admin/login-log?${params.toString()}`;
  }, [submittedQ, client, success, from, to]);

  const { data, error, loading, reload } = useAdminQuery<LoginLogPayload>(path);
  const rows = data?.rows || [];
  const stats = data?.stats;

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Login log"
        description="Who signed in, when, from where — successful and failed attempts for staff, POS and website."
      />

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedQ(q.trim());
        }}
      >
        <label>
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          <span>Client</span>
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="all">All</option>
            <option value="staff">Staff</option>
            <option value="pos">POS</option>
            <option value="website">Website</option>
          </select>
        </label>
        <label>
          <span>Result</span>
          <select value={success} onChange={(e) => setSuccess(e.target.value)}>
            <option value="all">All</option>
            <option value="yes">Success</option>
            <option value="no">Failed</option>
          </select>
        </label>
        <label className="admin-grow">
          <span>Search</span>
          <input
            placeholder="Email, name, IP, device…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button className="btn" type="submit">
          Apply
        </button>
        <button className="btn ghost" type="button" onClick={() => void reload()}>
          Refresh
        </button>
      </form>

      {error ? <AdminAlert>{error}</AdminAlert> : null}

      {stats ? (
        <div className="admin-card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          <AdminPanel title="Last 24h">
            <p style={{ fontSize: "1.35rem", margin: 0 }}>
              <b>{stats.total_24h}</b>
            </p>
          </AdminPanel>
          <AdminPanel title="Successful">
            <p style={{ fontSize: "1.35rem", margin: 0 }}>
              <b>{stats.success_24h}</b>
            </p>
          </AdminPanel>
          <AdminPanel title="Failed">
            <p style={{ fontSize: "1.35rem", margin: 0 }}>
              <b>{stats.failed_24h}</b>
            </p>
          </AdminPanel>
          <AdminPanel title="Staff / POS OK">
            <p style={{ fontSize: "1.35rem", margin: 0 }}>
              <b>{stats.staff_24h}</b>
            </p>
          </AdminPanel>
        </div>
      ) : null}

      <AdminPanel title="Login events">
        {loading ? <AdminLoading /> : null}
        {!loading && !rows.length ? (
          <AdminEmpty
            title="No login events yet"
            body="Events appear after the next staff, POS or website sign-in."
          />
        ) : null}
        {rows.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Client</th>
                  <th>Result</th>
                  <th>IP</th>
                  <th>Device</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <b>{row.full_name || row.email_attempted}</b>
                      <div className="muted admin-sub">
                        {row.user_email || row.email_attempted}
                      </div>
                    </td>
                    <td>{row.client}</td>
                    <td>
                      <AdminBadge tone={row.success ? "success" : statusTone("cancelled")}>
                        {row.success ? "success" : row.failure_code || "failed"}
                      </AdminBadge>
                    </td>
                    <td>{row.ip || "—"}</td>
                    <td>{row.device_label || "—"}</td>
                    <td>
                      <Link
                        className="admin-action-btn"
                        href={`/admin/login-log/${row.id}`}
                        data-tooltip="View details"
                        aria-label={`View login ${row.id}`}
                      >
                        <Eye size={14} />
                        <span>Details</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="muted" style={{ marginTop: 12 }}>
          <History size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
          Showing {rows.length} event{rows.length === 1 ? "" : "s"}
        </p>
      </AdminPanel>
    </div>
  );
}
