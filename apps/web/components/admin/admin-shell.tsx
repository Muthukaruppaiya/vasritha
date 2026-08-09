"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
  Menu,
  ChevronDown,
  Bell,
  FileText,
  SlidersHorizontal,
  Plug,
  type LucideIcon
} from "lucide-react";
import {
  adminFetch,
  clearAdminSession,
  formatDate,
  formatMoney,
  getAdminToken,
  getAdminUser,
  type AdminSessionUser
} from "@/lib/admin-api";
import {
  canAccessAdminPath,
  isAppRole,
  type AppRole
} from "@/lib/auth/rbac";
import { BrandSplash } from "../brand-splash";

type NavLeaf = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type NavModule = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavLeaf[];
};

type OrderNotice = {
  id: string;
  order_number: string;
  status: string;
  total_amount: string;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
};

type OrderNotifications = {
  activeCount: number;
  pendingCount: number;
  recent: OrderNotice[];
};

const SEEN_KEY = "vasritha_admin_orders_seen_at";

const navModules: NavModule[] = [
  {
    id: "overview",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin"
  },
  {
    id: "catalogue",
    label: "Catalogue",
    icon: Package,
    children: [
      { label: "Product Master", href: "/admin/products", icon: Package },
      { label: "Categories", href: "/admin/categories", icon: Tags },
      { label: "Inventory", href: "/admin/inventory", icon: Warehouse }
    ]
  },
  {
    id: "sales",
    label: "Sales",
    icon: ShoppingBag,
    children: [
      { label: "Online Orders", href: "/admin/orders", icon: ShoppingBag },
      { label: "Store POS", href: "/admin/billing", icon: Receipt },
      { label: "Returns", href: "/admin/returns", icon: RotateCcw },
      { label: "Coupons", href: "/admin/coupons", icon: TicketPercent }
    ]
  },
  {
    id: "invoices",
    label: "Invoice",
    icon: FileText,
    children: [
      { label: "Online Invoice", href: "/admin/invoices/online", icon: FileText },
      { label: "Store Invoice", href: "/admin/invoices/store", icon: Receipt }
    ]
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    children: [
      { label: "Customers", href: "/admin/customers", icon: UserRound },
      { label: "Users", href: "/admin/users", icon: Users }
    ]
  },
  {
    id: "content",
    label: "Content",
    icon: PanelsTopLeft,
    children: [
      { label: "Configuration", href: "/admin/configuration", icon: SlidersHorizontal },
      { label: "Reviews", href: "/admin/reviews", icon: MessageSquareQuote },
      { label: "CMS", href: "/admin/cms", icon: PanelsTopLeft }
    ]
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    children: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Integrations", href: "/admin/integrations", icon: Plug }
    ]
  }
];

function sessionRoles(user: AdminSessionUser | null): AppRole[] {
  return (user?.roles || []).filter(isAppRole);
}

function pathMatches(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function moduleContainsPath(module: NavModule, pathname: string) {
  if (module.href && pathMatches(pathname, module.href)) return true;
  return (module.children || []).some((child) => pathMatches(pathname, child.href));
}

function statusLabel(status: string) {
  if (status === "processing") return "Packing";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function readSeenAt() {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(SEEN_KEY);
  const value = raw ? Date.parse(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function writeSeenAt(iso: string) {
  window.localStorage.setItem(SEEN_KEY, iso);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [brandLogo, setBrandLogo] = useState("/vasritha-logo.svg");
  const [notifications, setNotifications] = useState<OrderNotifications>({
    activeCount: 0,
    pendingCount: 0,
    recent: []
  });
  const [seenAt, setSeenAt] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const isLogin = pathname === "/admin/login";
  const expanded = pinned || hovered || mobileOpen;
  const roles = useMemo(() => sessionRoles(user), [user]);
  const canViewOrders = useMemo(
    () => canAccessAdminPath(roles, "/admin/orders"),
    [roles]
  );

  const visibleModules = useMemo(() => {
    return navModules
      .map((module) => {
        if (module.href) {
          return canAccessAdminPath(roles, module.href) ? module : null;
        }
        const children = (module.children || []).filter((child) =>
          canAccessAdminPath(roles, child.href)
        );
        if (!children.length) return null;
        return { ...module, children };
      })
      .filter(Boolean) as NavModule[];
  }, [roles]);

  const unreadCount = useMemo(() => {
    return notifications.recent.filter((order) => Date.parse(order.created_at) > seenAt)
      .length;
  }, [notifications.recent, seenAt]);

  const salesBadgeCount = notifications.activeCount;

  useEffect(() => {
    fetch("/api/site-branding")
      .then((res) => res.json())
      .then((payload) => {
        const path = payload?.data?.logoPath as string | undefined;
        if (path) setBrandLogo(path);
      })
      .catch(() => undefined);
  }, []);

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
    setSeenAt(readSeenAt());
    setReady(true);
  }, [isLogin, pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  useEffect(() => {
    setOpenModules((current) => {
      let changed = false;
      const next = { ...current };
      for (const module of visibleModules) {
        if (module.children?.length && moduleContainsPath(module, pathname) && !next[module.id]) {
          next[module.id] = true;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [pathname, visibleModules]);

  useEffect(() => {
    if (isLogin || !ready || !canViewOrders) return;

    let cancelled = false;

    const load = async () => {
      const result = await adminFetch<OrderNotifications>("/api/admin/orders/notifications");
      if (cancelled || result.error || !result.data) return;
      setNotifications({
        activeCount: result.data.activeCount || 0,
        pendingCount: result.data.pendingCount || 0,
        recent: result.data.recent || []
      });
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isLogin, ready, canViewOrders, pathname]);

  useEffect(() => {
    if (!notifOpen) return;

    const onPointer = (event: MouseEvent) => {
      if (!notifRef.current?.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotifOpen(false);
    };

    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [notifOpen]);

  const toggleModule = (id: string) => {
    setOpenModules((current) => ({ ...current, [id]: !current[id] }));
  };

  const openNotifications = () => {
    setNotifOpen((open) => {
      const next = !open;
      if (next) {
        const unreadIds = notifications.recent
          .filter((order) => Date.parse(order.created_at) > seenAt)
          .map((order) => order.id);
        setHighlightIds(unreadIds);
        const latest = notifications.recent[0]?.created_at || new Date().toISOString();
        writeSeenAt(latest);
        setSeenAt(Date.parse(latest) || Date.now());
      }
      return next;
    });
  };

  if (!ready) {
    return <BrandSplash compact label="Opening admin workspace" />;
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
            <img className="brand-logo" src={brandLogo} alt="Vasritha" />
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
          {visibleModules.map((module) => {
            const ModuleIcon = module.icon;
            const hasChildren = Boolean(module.children?.length);
            const isOpen = Boolean(openModules[module.id]);
            const moduleActive = moduleContainsPath(module, pathname);
            const showSalesBadge = module.id === "sales" && salesBadgeCount > 0;

            if (!hasChildren && module.href) {
              const active = pathMatches(pathname, module.href);
              return (
                <Link
                  key={module.id}
                  href={module.href}
                  className={`admin-nav-link${active ? " is-active" : ""}`}
                  title={module.label}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="admin-nav-icon">
                    <ModuleIcon size={18} strokeWidth={1.9} />
                  </span>
                  <span className="admin-nav-label">{module.label}</span>
                </Link>
              );
            }

            const firstChild = module.children?.[0];

            return (
              <div
                key={module.id}
                className={`admin-nav-module${moduleActive ? " is-active-module" : ""}${
                  isOpen ? " is-open" : ""
                }`}
              >
                <button
                  type="button"
                  className="admin-nav-module-btn"
                  title={
                    showSalesBadge
                      ? `${module.label} · ${salesBadgeCount} active online orders`
                      : module.label
                  }
                  aria-expanded={isOpen}
                  onClick={() => {
                    if (!expanded && firstChild) {
                      router.push(firstChild.href);
                      setMobileOpen(false);
                      return;
                    }
                    toggleModule(module.id);
                  }}
                >
                  <span className="admin-nav-icon admin-nav-icon--badge">
                    <ModuleIcon size={18} strokeWidth={1.9} />
                    {showSalesBadge ? (
                      <span className="admin-nav-count" aria-hidden>
                        {salesBadgeCount > 99 ? "99+" : salesBadgeCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="admin-nav-label">{module.label}</span>
                  {showSalesBadge ? (
                    <span className="admin-nav-count admin-nav-count--inline" aria-hidden>
                      {salesBadgeCount > 99 ? "99+" : salesBadgeCount}
                    </span>
                  ) : null}
                  <span className="admin-nav-chevron" aria-hidden>
                    <ChevronDown size={16} strokeWidth={2} />
                  </span>
                </button>

                {hasChildren && (
                  <div className={`admin-nav-sub${isOpen ? " is-open" : ""}`}>
                    {module.children!.map((child) => {
                      const active = pathMatches(pathname, child.href);
                      const ChildIcon = child.icon;
                      const isOnlineOrders = child.href === "/admin/orders";
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`admin-nav-link admin-nav-sublink${active ? " is-active" : ""}`}
                          title={child.label}
                          onClick={() => setMobileOpen(false)}
                        >
                          <span className="admin-nav-icon">
                            <ChildIcon size={16} strokeWidth={1.9} />
                          </span>
                          <span className="admin-nav-label">{child.label}</span>
                          {isOnlineOrders && salesBadgeCount > 0 ? (
                            <span className="admin-nav-count admin-nav-count--inline" aria-hidden>
                              {salesBadgeCount > 99 ? "99+" : salesBadgeCount}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
            {canViewOrders ? (
              <div className="admin-notif" ref={notifRef}>
                <button
                  type="button"
                  className={`admin-notif-btn${notifOpen ? " is-open" : ""}`}
                  aria-label={
                    unreadCount > 0
                      ? `${unreadCount} new online order notifications`
                      : "Online order notifications"
                  }
                  aria-expanded={notifOpen}
                  onClick={openNotifications}
                >
                  <Bell size={17} strokeWidth={2} />
                  {unreadCount > 0 ? (
                    <span className="admin-notif-dot">{unreadCount > 9 ? "9+" : unreadCount}</span>
                  ) : salesBadgeCount > 0 ? (
                    <span className="admin-notif-dot admin-notif-dot--soft">
                      {salesBadgeCount > 9 ? "9+" : salesBadgeCount}
                    </span>
                  ) : null}
                </button>

                {notifOpen ? (
                  <div className="admin-notif-panel" role="dialog" aria-label="Online order notifications">
                    <div className="admin-notif-head">
                      <div>
                        <strong>Online orders</strong>
                        <p className="muted">
                          {notifications.pendingCount} pending · {notifications.activeCount} in queue
                        </p>
                      </div>
                      <Link href="/admin/orders" onClick={() => setNotifOpen(false)}>
                        View all
                      </Link>
                    </div>

                    {notifications.recent.length === 0 ? (
                      <div className="admin-notif-empty">No online orders yet.</div>
                    ) : (
                      <ul className="admin-notif-list">
                        {notifications.recent.map((order) => {
                          const isNew = highlightIds.includes(order.id);
                          return (
                            <li key={order.id}>
                              <Link
                                href="/admin/orders"
                                className={`admin-notif-item${isNew ? " is-new" : ""}`}
                                onClick={() => setNotifOpen(false)}
                              >
                                <div className="admin-notif-item-top">
                                  <strong>{order.order_number}</strong>
                                  <span>{formatMoney(order.total_amount)}</span>
                                </div>
                                <p>
                                  {order.customer_name || order.customer_email || "Customer"} ·{" "}
                                  {statusLabel(order.status)}
                                </p>
                                <span className="admin-notif-time">{formatDate(order.created_at)}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

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
