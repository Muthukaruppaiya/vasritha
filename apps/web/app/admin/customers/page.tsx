"use client";

import { useMemo, useState } from "react";
import {
  AdminAlert,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { formatDate } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Customer = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
};

export default function AdminCustomersPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const path = useMemo(
    () => `/api/admin/customers${submitted ? `?q=${encodeURIComponent(submitted)}` : ""}`,
    [submitted]
  );
  const { data, error, loading } = useAdminQuery<Customer[]>(path);

  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Search registered buyers and support contacts."
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

      <AdminPanel title="Directory">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !(data || []).length && (
          <AdminEmpty title="No customers found" body="Try another search or wait for registrations." />
        )}
        {(data || []).length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <b>{customer.full_name}</b>
                    </td>
                    <td>{customer.email}</td>
                    <td>{customer.phone || "—"}</td>
                    <td>{formatDate(customer.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </>
  );
}
