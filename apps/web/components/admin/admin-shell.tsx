"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingBag,
  Receipt,
  Users,
  UserRound,
  Warehouse,
  TicketPercent,
  RotateCcw,
  MessageSquareQuote,
  PanelsTopLeft,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu
} from "lucide-react";
import {
  clearAdminSession,
  getAdminToken,
  getAdminUser,
  type AdminSessionUser
} from "@/lib/admin-api";
import {
  canAccessAdminPath,
  isAppRole,
  type AppRole
} from "@/lib/auth/rbac";

const nav = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Product Master", href: "/admin/products", icon: Package },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Online Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Store POS", href: "/admin/billing", icon: Receipt },
  { label: "Customers", href: "/admin/customers", icon: UserRound },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Inventory", href: "/admin/inventory", icon: Warehouse },
  { label: "Coupons", href: "/admin/coupons", icon: TicketPercent },
  { label: "Returns", href: "/admin/returns", icon: RotateCcw },
  { label: "Reviews", href: "/admin/reviews", icon: MessageSquareQuote },
  { label: "CMS", href: "/admin/cms", icon: PanelsTopLeft },
  { label: "Settings", href: "/admin/settings", icon: Settings }
];

function sessionRoles(user: AdminSessionUser | null): AppRole[] {
  return (user?.roles || []).filter(isAppRole);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLogin = pathname === "/admin/login";
  const expanded = pinned || hovered || mobileOpen;

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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="admin-loading">
        <p>Opening admin workspace…</p>
      </div>
    );
  }

  if (isLogin) return <>{children}</>;

  return (
    <div className={`admin ${expanded ? "is-nav-open" : "is-nav-collapsed"} ${pinned ? "is-nav-pinned" : ""}`}>
      <button
        type="button"
        className="admin-nav-fab"
        aria-label={expanded ? "Collapse navigation" : "Open navigation"}
        aria-expanded={expanded}
        onClick={() => {
          if (window.matchMedia("(max-width: 980px)").matches) {
            setMobileOpen((v) => !v);
            return;
          }
          setPinned((v) => !v);
        }}
        onMouseEnter={() => setHovered(true)}
      >
        <Menu size={18} strokeWidth={2} />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="admin-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar ${expanded ? "is-expanded" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="admin-sidebar-top">
          <Link href="/" className="admin-brand" aria-label="Vasritha home">
            <img className="brand-logo" src="/vasritha-logo.svg" alt="Vasritha" />
            <div className="admin-brand-copy">
              <strong>Vasritha</strong>
              <span>Admin</span>
            </div>
          </Link>

          <button
            type="button"
            className="admin-nav-pin"
            aria-label={pinned ? "Unpin navigation" : "Pin navigation open"}
            title={pinned ? "Unpin" : "Pin open"}
            onClick={() => setPinned((v) => !v)}
          >
            {pinned ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>

        <nav className="admin-nav" aria-label="Admin">
          {nav
            .filter((item) => canAccessAdminPath(sessionRoles(user), item.href))
            .map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "is-active" : ""}
                title={item.label}
                onClick={() => setMobileOpen(false)}
              >
                <span className="admin-nav-icon">
                  <Icon size={18} strokeWidth={1.9} />
                </span>
                <span className="admin-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <p className="admin-topbar-kicker">Vasritha workspace</p>
            <strong className="admin-topbar-title">Admin console</strong>
          </div>

          <div className="admin-topbar-right">
            <div className="admin-topbar-user">
              <span className="admin-user-avatar">
                {(user?.fullName || user?.email || "A").charAt(0).toUpperCase()}
              </span>
              <div className="admin-user-meta is-visible">
                <strong>{user?.fullName || "Vasritha Admin"}</strong>
                <span>{user?.email}</span>
              </div>
            </div>

            <button
              type="button"
              className="admin-logout admin-logout--icon"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => {
                clearAdminSession();
                router.replace("/admin/login");
              }}
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
