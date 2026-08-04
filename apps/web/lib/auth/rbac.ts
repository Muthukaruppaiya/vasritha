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
  | "users:manage"
  | "roles:manage"
  | "audit:read"
  | "dashboard:all"
  | "dashboard:ops"
  | "dashboard:finance"
  | "settings:business"
  | "pricing:manage"
  | "pricing:limited"
  | "refunds:approve"
  | "refunds:initiate"
  | "products:manage"
  | "products:read"
  | "categories:manage"
  | "stock:approve"
  | "stock:operate"
  | "orders:manage"
  | "orders:view"
  | "orders:fulfill"
  | "orders:own"
  | "shipping:manage"
  | "reports:ops"
  | "reports:finance"
  | "customers:search"
  | "customers:support"
  | "customers:manage"
  | "pos:create"
  | "invoices:print"
  | "invoices:own"
  | "returns:initiate"
  | "returns:handle"
  | "cms:manage"
  | "profile:own"
  | "addresses:own"
  | "cart:own"
  | "wishlist:own"
  | "checkout:own"
  | "finance:read"
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

export const ROLE_META: Record<
  AppRole,
  { name: string; purpose: string; mvp: boolean; restrictedFrom: string }
> = {
  super_admin: {
    name: "Super Admin",
    purpose: "Technical and master administration",
    mvp: true,
    restrictedFrom: "None except protected system constraints"
  },
  business_owner: {
    name: "Business Owner",
    purpose: "Overall business control",
    mvp: true,
    restrictedFrom: "Direct database manipulation"
  },
  manager: {
    name: "Manager",
    purpose: "Day-to-day supervision",
    mvp: true,
    restrictedFrom: "Ownership-level credentials and system secrets"
  },
  billing_staff: {
    name: "Billing Staff",
    purpose: "Retail billing",
    mvp: true,
    restrictedFrom: "Tax setup, user roles, unrestricted stock adjustments"
  },
  inventory_staff: {
    name: "Inventory Staff",
    purpose: "Stock operations",
    mvp: true,
    restrictedFrom: "Refund approval and sensitive financial settings"
  },
  packing_shipping_staff: {
    name: "Packing & Shipping Staff",
    purpose: "Order fulfillment",
    mvp: true,
    restrictedFrom: "Pricing, purchasing, payment refunds"
  },
  customer_support_staff: {
    name: "Customer Support Staff",
    purpose: "Customer assistance",
    mvp: true,
    restrictedFrom: "Stock changes, tax setup, unrestricted refunds"
  },
  accountant: {
    name: "Accountant / Finance",
    purpose: "Financial review",
    mvp: false,
    restrictedFrom: "Operational editing unless specifically granted"
  },
  customer: {
    name: "Vasritha Customer",
    purpose: "Online shopping and self-service",
    mvp: true,
    restrictedFrom: "Any other customer or internal business data"
  }
};

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  super_admin: [
    "config:all",
    "users:manage",
    "roles:manage",
    "audit:read",
    "dashboard:all",
    "dashboard:ops",
    "dashboard:finance",
    "settings:business",
    "pricing:manage",
    "refunds:approve",
    "refunds:initiate",
    "products:manage",
    "products:read",
    "categories:manage",
    "stock:approve",
    "stock:operate",
    "orders:manage",
    "orders:view",
    "orders:fulfill",
    "shipping:manage",
    "reports:ops",
    "reports:finance",
    "customers:search",
    "customers:support",
    "customers:manage",
    "pos:create",
    "invoices:print",
    "returns:initiate",
    "returns:handle",
    "cms:manage",
    "finance:read",
    "exports:finance"
  ],
  business_owner: [
    "dashboard:all",
    "dashboard:ops",
    "dashboard:finance",
    "settings:business",
    "pricing:manage",
    "refunds:approve",
    "refunds:initiate",
    "products:manage",
    "products:read",
    "categories:manage",
    "stock:approve",
    "stock:operate",
    "orders:manage",
    "orders:view",
    "orders:fulfill",
    "shipping:manage",
    "reports:ops",
    "reports:finance",
    "customers:search",
    "customers:support",
    "customers:manage",
    "pos:create",
    "invoices:print",
    "returns:initiate",
    "returns:handle",
    "cms:manage",
    "users:manage",
    "audit:read",
    "finance:read",
    "exports:finance"
  ],
  manager: [
    "dashboard:ops",
    "products:manage",
    "products:read",
    "categories:manage",
    "pricing:limited",
    "stock:approve",
    "stock:operate",
    "orders:manage",
    "orders:view",
    "orders:fulfill",
    "shipping:manage",
    "reports:ops",
    "customers:search",
    "customers:support",
    "pos:create",
    "invoices:print",
    "returns:initiate",
    "returns:handle",
    "cms:manage"
  ],
  billing_staff: [
    "dashboard:ops",
    "products:read",
    "customers:search",
    "pos:create",
    "invoices:print",
    "orders:view",
    "returns:initiate",
    "orders:manage"
  ],
  inventory_staff: [
    "dashboard:ops",
    "products:manage",
    "products:read",
    "stock:operate",
    "orders:view"
  ],
  packing_shipping_staff: [
    "dashboard:ops",
    "orders:view",
    "orders:fulfill",
    "shipping:manage",
    "products:read"
  ],
  customer_support_staff: [
    "dashboard:ops",
    "customers:search",
    "customers:support",
    "orders:view",
    "returns:handle",
    "products:read"
  ],
  accountant: [
    "dashboard:finance",
    "finance:read",
    "reports:finance",
    "exports:finance",
    "orders:view",
    "invoices:print",
    "products:read"
  ],
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

export function isStaffRole(role: AppRole) {
  return role !== "customer";
}

export function highestRole(roles: AppRole[]): AppRole | null {
  for (const role of ROLE_ORDER) {
    if (roles.includes(role)) return role;
  }
  return null;
}
