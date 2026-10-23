export type AppRole =
  | "super_admin"
  | "business_owner"
  | "manager"
  | "billing_staff"
  | "inventory_staff"
  | "packing_shipping_staff"
  | "customer_support_staff"
  | "accountant"
  | "customer";

export type Permission =
  | "config:all"
  | "data:admin"
  | "users:manage"
  | "roles:manage"
  | "audit:read"
  | "dashboard:all"
  | "dashboard:ops"
  | "dashboard:finance"
  | "settings:business"
  | "pricing:manage"
  | "pricing:limited"
  | "purchases:operate"
  | "refunds:approve"
  | "refunds:initiate"
  | "products:manage"
  | "products:read"
  | "products:approve"
  | "categories:manage"
  | "stock:approve"
  | "stock:operate"
  | "orders:manage"
  | "orders:view"
  | "orders:fulfill"
  | "orders:own"
  | "shipping:manage"
  | "tracking:update"
  | "reports:ops"
  | "reports:finance"
  | "customers:search"
  | "customers:support"
  | "customers:manage"
  | "pos:create"
  | "invoices:print"
  | "invoices:share"
  | "invoices:own"
  | "returns:initiate"
  | "returns:handle"
  | "cms:manage"
  | "coupons:manage"
  | "profile:own"
  | "addresses:own"
  | "cart:own"
  | "wishlist:own"
  | "checkout:own"
  | "finance:read"
  | "finance:write"
  | "exports:finance";

export const ROLE_ORDER: AppRole[] = [
  "super_admin",
  "business_owner",
  "manager",
  "billing_staff",
  "inventory_staff",
  "packing_shipping_staff",
  "customer_support_staff",
  "accountant",
  "customer"
];

/** Spec matrix: Role → Purpose → Typical Permissions (human-readable). */
export const ROLE_META: Record<
  AppRole,
  {
    name: string;
    purpose: string;
    typicalPermissions: string;
    mvp: boolean;
    restrictedFrom: string;
  }
> = {
  super_admin: {
    name: "Super Admin",
    purpose: "Technical and master administration",
    typicalPermissions:
      "All configuration, users, roles, data administration, audit review",
    mvp: true,
    restrictedFrom: "None except protected system constraints"
  },
  business_owner: {
    name: "Business Owner",
    purpose: "Overall business control",
    typicalPermissions:
      "All operational dashboards, approvals, reports, pricing, refunds, settings",
    mvp: true,
    restrictedFrom: "Direct database manipulation and system secrets"
  },
  manager: {
    name: "Manager",
    purpose: "Day-to-day supervision",
    typicalPermissions:
      "Products, product approval, pricing within limits, purchases, stock approvals, orders, shipping, reports",
    mvp: true,
    restrictedFrom: "Ownership-level credentials and system secrets"
  },
  billing_staff: {
    name: "Billing Staff",
    purpose: "Retail billing",
    typicalPermissions:
      "POS, own shift, store invoices, own sales reports, P&L, stock value",
    mvp: true,
    restrictedFrom: "Catalogue, purchases, finance ledgers, other staff sales, system settings"
  },
  inventory_staff: {
    name: "Inventory Staff",
    purpose: "Stock operations",
    typicalPermissions:
      "Create/edit products (pending approval), purchase receipt, counts, transfers, damage",
    mvp: true,
    restrictedFrom: "Publishing products, refund approval and sensitive financial settings"
  },
  packing_shipping_staff: {
    name: "Packing & Shipping Staff",
    purpose: "Order fulfilment",
    typicalPermissions:
      "Pick, pack, package, courier, AWB, dispatch, tracking updates",
    mvp: true,
    restrictedFrom: "Pricing, purchasing, payment refunds"
  },
  customer_support_staff: {
    name: "Customer Support Staff",
    purpose: "Customer assistance",
    typicalPermissions:
      "Customer profile, order view, tracking, cancellation/return request handling",
    mvp: true,
    restrictedFrom: "Stock changes, tax setup, unrestricted refunds"
  },
  accountant: {
    name: "Accountant / Finance",
    purpose: "Financial review",
    typicalPermissions:
      "Invoices, tax summaries, payment and purchase reports, exports",
    mvp: false,
    restrictedFrom: "Operational editing unless specifically granted"
  },
  customer: {
    name: "Vasritha Customer",
    purpose: "Online shopping and self-service",
    typicalPermissions:
      "Own profile, addresses, cart, checkout, own orders, invoices, tracking, returns",
    mvp: true,
    restrictedFrom: "Any other customer or internal business data"
  }
};

const ALL_STAFF_PERMISSIONS: Permission[] = [
  "config:all",
  "data:admin",
  "users:manage",
  "roles:manage",
  "audit:read",
  "dashboard:all",
  "dashboard:ops",
  "dashboard:finance",
  "settings:business",
  "pricing:manage",
  "pricing:limited",
  "purchases:operate",
  "refunds:approve",
  "refunds:initiate",
  "products:manage",
  "products:read",
  "products:approve",
  "categories:manage",
  "stock:approve",
  "stock:operate",
  "orders:manage",
  "orders:view",
  "orders:fulfill",
  "shipping:manage",
  "tracking:update",
  "reports:ops",
  "reports:finance",
  "customers:search",
  "customers:support",
  "customers:manage",
  "pos:create",
  "invoices:print",
  "invoices:share",
  "returns:initiate",
  "returns:handle",
  "cms:manage",
  "coupons:manage",
  "finance:read",
  "finance:write",
  "exports:finance"
];

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  // Spec: all configuration, users, roles, data administration, audit review
  super_admin: [...ALL_STAFF_PERMISSIONS],

  // Spec: all operational dashboards, approvals, reports, pricing, refunds, settings
  // (no config:all / data:admin — not direct system administration)
  business_owner: [
    "dashboard:all",
    "dashboard:ops",
    "dashboard:finance",
    "settings:business",
    "pricing:manage",
    "purchases:operate",
    "refunds:approve",
    "refunds:initiate",
    "products:manage",
    "products:read",
    "products:approve",
    "categories:manage",
    "stock:approve",
    "stock:operate",
    "orders:manage",
    "orders:view",
    "orders:fulfill",
    "shipping:manage",
    "tracking:update",
    "reports:ops",
    "reports:finance",
    "customers:search",
    "customers:support",
    "customers:manage",
    "pos:create",
    "invoices:print",
    "invoices:share",
    "returns:initiate",
    "returns:handle",
    "cms:manage",
    "coupons:manage",
    "users:manage",
    "roles:manage",
    "audit:read",
    "finance:read",
    "finance:write",
    "exports:finance"
  ],

  // Spec: products, pricing within limits, purchases, stock approvals, orders, shipping, reports
  manager: [
    "dashboard:ops",
    "products:manage",
    "products:read",
    "products:approve",
    "categories:manage",
    "pricing:limited",
    "purchases:operate",
    "stock:approve",
    "stock:operate",
    "orders:manage",
    "orders:view",
    "orders:fulfill",
    "shipping:manage",
    "tracking:update",
    "reports:ops",
    "customers:search",
    "customers:support",
    "pos:create",
    "invoices:print",
    "invoices:share",
    "returns:initiate",
    "returns:handle",
    "cms:manage",
    "coupons:manage"
  ],

  // Spec: customer search, POS, invoice print/share, permitted return initiation
  billing_staff: [
    "dashboard:ops",
    "products:read",
    "customers:search",
    "pos:create",
    "invoices:print",
    "invoices:share",
    "returns:initiate",
    "reports:ops"
  ],

  // Spec: products, purchase receipt, counts, transfers, damage, approved adjustments
  inventory_staff: [
    "dashboard:ops",
    "products:manage",
    "products:read",
    "purchases:operate",
    "stock:operate",
    "orders:view"
  ],

  // Spec: pick, pack, package, courier, AWB, dispatch, tracking updates
  packing_shipping_staff: [
    "dashboard:ops",
    "orders:view",
    "orders:fulfill",
    "shipping:manage",
    "tracking:update",
    "invoices:print",
    "products:read"
  ],

  // Spec: customer profile, order view, tracking, cancellation/return request handling
  customer_support_staff: [
    "dashboard:ops",
    "customers:search",
    "customers:support",
    "orders:view",
    "tracking:update",
    "returns:initiate",
    "returns:handle",
    "products:read",
    "invoices:print"
  ],

  // Spec: invoices, tax summaries, payment and purchase reports, exports
  accountant: [
    "dashboard:finance",
    "finance:read",
    "finance:write",
    "reports:finance",
    "exports:finance",
    "orders:view",
    "invoices:print",
    "products:read",
    "purchases:operate"
  ],

  // Spec: own profile, addresses, cart, checkout, own orders, invoices, tracking, returns
  customer: [
    "profile:own",
    "addresses:own",
    "cart:own",
    "wishlist:own",
    "checkout:own",
    "orders:own",
    "invoices:own",
    "returns:initiate",
    "products:read"
  ]
};

/** Nav item → any-of permissions required to see it. */
export const ADMIN_NAV_PERMISSIONS: Record<string, Permission[]> = {
  "/admin": ["dashboard:all", "dashboard:ops", "dashboard:finance"],
  "/admin/products": ["products:manage", "products:read"],
  "/admin/products/new": ["products:manage"],
  "/admin/categories": ["categories:manage", "products:manage"],
  "/admin/orders": ["orders:view", "orders:manage", "orders:fulfill"],
  "/admin/billing": ["pos:create", "invoices:print"],
  "/admin/billing/shift": ["pos:create", "invoices:print"],
  "/admin/billing/dues": ["pos:create", "invoices:print", "finance:read"],
  "/admin/invoices/online": ["invoices:print", "orders:view", "orders:manage"],
  "/admin/invoices/store": ["invoices:print", "pos:create", "orders:view"],
  "/admin/customers": ["customers:search", "customers:support", "customers:manage"],
  "/admin/users": ["users:manage"],
  "/admin/login-log": ["audit:read", "users:manage"],
  "/admin/inventory": ["stock:operate", "stock:approve", "purchases:operate"],
  "/admin/inventory/grn": ["stock:operate", "stock:approve", "purchases:operate"],
  "/admin/inventory/grn/history": ["stock:operate", "stock:approve", "purchases:operate"],
  "/admin/inventory/approvals": ["stock:operate", "stock:approve", "purchases:operate"],
  "/admin/inventory/ledger": ["stock:operate", "stock:approve", "purchases:operate"],
  "/admin/barcodes": ["products:manage", "products:read", "stock:operate", "purchases:operate"],
  "/admin/suppliers": ["purchases:operate", "settings:business", "stock:operate"],
  "/admin/coupons": ["coupons:manage", "pricing:manage", "pricing:limited"],
  "/admin/loyalty": ["settings:business", "config:all", "coupons:manage"],
  "/admin/returns": ["returns:handle", "returns:initiate"],
  "/admin/reviews": ["cms:manage"],
  "/admin/configuration": ["cms:manage"],
  "/admin/cms": ["cms:manage"],
  "/admin/settings": ["settings:business", "roles:manage", "config:all"],
  "/admin/brands": ["settings:business", "config:all"],
  "/admin/shops": ["settings:business", "config:all"],
  "/admin/integrations": ["settings:business", "config:all"],
  "/admin/finance": ["finance:read", "finance:write", "reports:finance", "dashboard:finance"],
  "/admin/finance/pnl": ["finance:read", "finance:write", "reports:finance", "dashboard:finance"],
  "/admin/finance/incoming": ["finance:read", "finance:write", "reports:finance", "dashboard:finance"],
  "/admin/finance/receivables": ["finance:read", "finance:write", "reports:finance", "dashboard:finance"],
  "/admin/finance/payables": ["finance:read", "finance:write", "reports:finance", "dashboard:finance"],
  "/admin/finance/expenses": ["finance:read", "finance:write", "reports:finance", "dashboard:finance"],
  "/admin/finance/cash-bank": ["finance:read", "finance:write", "reports:finance", "dashboard:finance"],
  "/admin/finance/reports": ["finance:read", "finance:write", "reports:finance", "exports:finance", "dashboard:finance"],
  "/admin/reports": ["reports:ops", "reports:finance", "exports:finance", "dashboard:ops", "dashboard:finance", "dashboard:all", "finance:read"],
  "/admin/reports/sales": ["reports:ops", "reports:finance", "dashboard:ops"],
  "/admin/reports/profit": ["reports:ops", "reports:finance", "dashboard:ops", "finance:read"],
  "/admin/reports/salesman": ["reports:ops", "reports:finance", "dashboard:ops"],
  "/admin/reports/stock_value": ["reports:ops", "reports:finance", "dashboard:ops", "stock:operate"]
};

/** Paths a billing-only staff member may open (sales-person workspace). */
export const BILLING_STAFF_PATHS = [
  "/admin",
  "/admin/billing",
  "/admin/billing/shift",
  "/admin/billing/dues",
  "/admin/returns",
  "/admin/invoices/store",
  "/admin/customers",
  "/admin/reports",
  "/admin/reports/sales",
  "/admin/reports/profit",
  "/admin/reports/salesman",
  "/admin/reports/stock_value"
] as const;

export const BILLING_REPORT_TYPES = [
  "sales",
  "profit",
  "salesman",
  "stock_value"
] as const;

/** True when the session is only billing staff (not also owner/manager). */
export function isBillingOnlyStaff(roles: AppRole[]) {
  const staff = roles.filter((role) => role !== "customer");
  return staff.length > 0 && staff.every((role) => role === "billing_staff");
}

export function canAccessReportType(roles: AppRole[], type: string) {
  if (
    !hasAnyPermission(roles, [
      "reports:ops",
      "reports:finance",
      "exports:finance",
      "dashboard:ops",
      "dashboard:finance",
      "dashboard:all",
      "finance:read"
    ])
  ) {
    return false;
  }
  if (isBillingOnlyStaff(roles)) {
    return (BILLING_REPORT_TYPES as readonly string[]).includes(type);
  }
  return true;
}

export function permissionsForRoles(roles: AppRole[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) set.add(permission);
  }
  return set;
}

export function hasPermission(roles: AppRole[], permission: Permission) {
  return permissionsForRoles(roles).has(permission);
}

export function hasAnyPermission(roles: AppRole[], permissions: Permission[]) {
  const set = permissionsForRoles(roles);
  return permissions.some((permission) => set.has(permission));
}

export function canAccessAdminPath(roles: AppRole[], href: string) {
  const path = href.split("?")[0];
  if (isBillingOnlyStaff(roles)) {
    return (BILLING_STAFF_PATHS as readonly string[]).includes(path);
  }
  const required = ADMIN_NAV_PERMISSIONS[href] || ADMIN_NAV_PERMISSIONS[path];
  if (required?.length) return hasAnyPermission(roles, required);
  if (href.startsWith("/admin/reports/")) {
    const type = href.slice("/admin/reports/".length);
    return canAccessReportType(roles, type);
  }
  return true;
}

export function isStaffRole(role: AppRole) {
  return role !== "customer";
}

export function highestRole(roles: AppRole[]): AppRole | null {
  for (const role of ROLE_ORDER) {
    if (roles.includes(role)) return role;
  }
  return null;
}

export function isAppRole(value: string): value is AppRole {
  return (ROLE_ORDER as string[]).includes(value);
}
