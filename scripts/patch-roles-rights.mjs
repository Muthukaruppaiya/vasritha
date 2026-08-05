/**
 * Sync system role names/descriptions to the roles & rights spec.
 * Usage: node --env-file=apps/web/.env.local scripts/patch-roles-rights.mjs
 */
import pg from "pg";

const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

const ROLES = [
  {
    code: "super_admin",
    name: "Super Admin",
    description: "Technical and master administration"
  },
  {
    code: "business_owner",
    name: "Business Owner",
    description: "Overall business control"
  },
  {
    code: "manager",
    name: "Manager",
    description: "Day-to-day supervision"
  },
  {
    code: "billing_staff",
    name: "Billing Staff",
    description: "Retail billing"
  },
  {
    code: "inventory_staff",
    name: "Inventory Staff",
    description: "Stock operations"
  },
  {
    code: "packing_shipping_staff",
    name: "Packing & Shipping Staff",
    description: "Order fulfilment"
  },
  {
    code: "customer_support_staff",
    name: "Customer Support Staff",
    description: "Customer assistance"
  },
  {
    code: "accountant",
    name: "Accountant / Finance",
    description: "Financial review"
  },
  {
    code: "customer",
    name: "Vasritha Customer",
    description: "Online shopping and self-service"
  }
];

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();

  for (const role of ROLES) {
    await client.query(
      `insert into public.roles (code, name, description, is_mvp, is_system, permission_template)
       values ($1, $2, $3, $4, true, $1)
       on conflict (code) do update
         set name = excluded.name,
             description = excluded.description,
             is_system = true,
             permission_template = coalesce(public.roles.permission_template, excluded.code)`,
      [role.code, role.name, role.description, role.code !== "accountant"]
    );
  }

  console.log(`Synced ${ROLES.length} system roles to roles & rights spec.`);
} catch (error) {
  console.error("Patch failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
