/**
 * Ensure one active gift voucher is set to show on website open.
 * Usage: node --env-file=apps/web/.env.local scripts/seed-opening-voucher.mjs
 */
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

await client.connect();

await client.query(`
  alter table public.coupons
    add column if not exists kind text not null default 'coupon',
    add column if not exists show_on_open boolean not null default false,
    add column if not exists headline text
`);

const existing = await client.query(`
  select id, code
  from coupons
  where show_on_open = true and status = 'active'
  limit 1
`);

if (existing.rows[0]) {
  console.log(`Opening voucher already active: ${existing.rows[0].code}`);
  await client.end();
  process.exit(0);
}

await client.query(`update coupons set show_on_open = false`);

const inserted = await client.query(
  `
  insert into coupons (
    code, description, discount_type, discount_value, min_order_amount,
    max_discount_amount, usage_limit, usage_limit_per_customer, status,
    kind, show_on_open, headline
  ) values (
    $1, $2, 'percentage', 10, 0,
    2000, null, 1, 'active',
    'gift_voucher', true, $3
  )
  on conflict (code) do update set
    status = 'active',
    kind = 'gift_voucher',
    show_on_open = true,
    headline = excluded.headline,
    description = excluded.description,
    discount_type = excluded.discount_type,
    discount_value = excluded.discount_value,
    min_order_amount = excluded.min_order_amount,
    max_discount_amount = excluded.max_discount_amount,
    usage_limit_per_customer = excluded.usage_limit_per_customer
  returning id, code
  `,
  [
    "WELCOME10",
    "Scratch to unlock 10% off your first Vasritha order.",
    "Welcome gift"
  ]
);

console.log(`Seeded opening voucher: ${inserted.rows[0].code} (${inserted.rows[0].id})`);
await client.end();
