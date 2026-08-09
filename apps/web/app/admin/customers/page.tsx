"use client";

import { useMemo, useState } from "react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { formatDate, formatMoney } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type CustomerChannel = "online" | "offline";

type CustomerRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  order_count: string;
  total_spent: string;
  last_order_at: string | null;
  customer_channel: CustomerChannel;
};

export default function AdminCustomersPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | CustomerChannel>("all");

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (submitted) params.set("q", submitted);
    if (channelFilter !== "all") params.set("type", channelFilter);
    const qs = params.toString();
    return `/api/admin/customers${qs ? `?${qs}` : ""}`;
  }, [submitted, channelFilter]);

  const { data, error, loading } = useAdminQuery<CustomerRow[]>(path);

  return (
    <>
      <AdminPageHeader eyebrow="" title="Customers" />

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim());
        }}
      >
        <label className="admin-grow">
          <span>Search</span>
          <input
            placeholder="Name, email or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      <div className="admin-tabs">
        <button
          type="button"
          className={channelFilter === "all" ? "is-active" : ""}
          onClick={() => setChannelFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={channelFilter === "online" ? "is-active" : ""}
          onClick={() => setChannelFilter("online")}
        >
          Online
        </button>
        <button
          type="button"
          className={channelFilter === "offline" ? "is-active" : ""}
          onClick={() => setChannelFilter("offline")}
        >
          Store / Offline
        </button>
      </div>

      <AdminPanel title="Customer directory">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !(data || []).length && (
          <AdminEmpty
            title="No customers found"
            body="Customers appear here when shoppers register online or when walk-in sales are billed at the store."
          />
        )}
        {(data || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Orders</th>
                  <th>Total spent</th>
                  <th>Last order</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((customer) => {
                  const orderCount = Number(customer.order_count || 0);
                  const isOffline = customer.customer_channel === "offline";
                  return (
                    <tr key={customer.id}>
                      <td>
                        <b>{customer.full_name}</b>
                      </td>
                      <td>
                        <AdminBadge tone={isOffline ? "warn" : "success"}>
                          {isOffline ? "Store / Offline" : "Online"}
                        </AdminBadge>
                      </td>
                      <td>{customer.email}</td>
                      <td>{customer.phone || "—"}</td>
                      <td>
                        <AdminBadge tone={orderCount > 0 ? "info" : "neutral"}>
                          {orderCount} order{orderCount === 1 ? "" : "s"}
                        </AdminBadge>
                      </td>
                      <td>{formatMoney(customer.total_spent)}</td>
                      <td>
                        {customer.last_order_at ? formatDate(customer.last_order_at) : "—"}
                      </td>
                      <td>{formatDate(customer.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </>
  );
}
