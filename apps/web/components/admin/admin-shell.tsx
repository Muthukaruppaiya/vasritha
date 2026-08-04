"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  clearAdminSession,
  getAdminToken,
  getAdminUser,
  type AdminSessionUser
} from "@/lib/admin-api";

const nav = [
  { label: "Dashboard", href: "/admin" },
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Billing", href: "/admin/billing" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Inventory", href: "/admin/inventory" },
  { label: "Coupons", href: "/admin/coupons" },
  { label: "Returns", href: "/admin/returns" },
  { label: "CMS", href: "/admin/cms" },
  { label: "Settings", href: "/admin/settings" }
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }

    const token = getAdminToken();
    const sessionUser = getAdminUser();
    if (!token || !sessionUser) {
      router.replace("/admin/login");
      return;
    }

    const isStaff = (sessionUser.roles || []).some((role) => role !== "customer");
    if (!isStaff) {
      clearAdminSession();
      router.replace("/admin/login");
      return;
    }

    setUser(sessionUser);
    setReady(true);
  }, [isLogin, pathname, router]);

  if (!ready) {
    return (
      <div className="admin-loading">
        <p>Opening admin workspace…</p>
      </div>
    );
  }

  if (isLogin) return <>{children}</>;

  return (
    <div className="admin">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand" aria-label="Vasritha home">
          <img className="brand-logo" src="/vasritha-logo.svg" alt="Vasritha" />
          <div>
            <strong>Vasritha</strong>
            <span>Admin</span>
          </div>
        </Link>

        <nav className="admin-nav" aria-label="Admin">
          {nav.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? "is-active" : ""}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-foot">
          <div>
            <strong>{user?.primaryRoleName || "Staff"}</strong>
            <span>{user?.email}</span>
          </div>
          <button
            type="button"
            className="admin-logout"
            onClick={() => {
              clearAdminSession();
              router.replace("/admin/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="admin-main">{children}</div>
    </div>
  );
}
