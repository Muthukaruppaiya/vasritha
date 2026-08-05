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

type CustomerRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  order_count: string;
  total_spent: string;
  last_order_at: string | null;
};

export default function AdminCustomersPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  const path = useMemo(
    () => `/api/admin/customers${submitted ? `?q=${encodeURIComponent(submitted)}` : ""}`,
    [submitted]
  );
  const { data, error, loading } = useAdminQuery<CustomerRow[]>(path);

  return (
    <>
      <AdminPageHeader
        eyebrow=""
        title="Customers"
        description="Storefront shoppers who registered or placed orders. Staff accounts live under Users."
      />

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

      <AdminPanel title="Customer directory">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !(data || []).length && (
          <AdminEmpty
            title="No customers found"
            body="Customers appear here when shoppers create an account on the storefront."
          />
        )}
        {(data || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
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
                  return (
                    <tr key={customer.id}>
                      <td>
                        <b>{customer.full_name}</b>
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
