/**
 * POS billing schema: orders.discount_amount, orders.channel, walk-in customer.
 * Usage: node --env-file=apps/web/.env.local scripts/patch-pos-billing.mjs
 */
import bcrypt from "bcryptjs";
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";

const WALK_IN_EMAIL = "pos@vasritha.local";
const WALK_IN_NAME = "Walk-in Customer";

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("begin");

    await client.query(`
      alter table public.orders
        add column if not exists discount_amount numeric(12,2) not null default 0
    `);
    await client.query(`
      alter table public.orders
        add column if not exists channel text not null default 'online'
    `);
    await client.query(`
      do $$
      begin
        if not exists (
          select 1 from pg_constraint where conname = 'orders_channel_check'
        ) then
          alter table public.orders
            add constraint orders_channel_check check (channel in ('online', 'pos'));
        end if;
      end $$;
    `);

    const existing = await client.query(`select id from users where email = $1`, [WALK_IN_EMAIL]);
    if (!existing.rows.length) {
      const passwordHash = await bcrypt.hash("PosWalkIn@local", 10);
      const user = await client.query(
        `insert into users (email, password_hash, full_name, phone)
         values ($1, $2, $3, null)
         returning id`,
        [WALK_IN_EMAIL, passwordHash, WALK_IN_NAME]
      );
      const userId = user.rows[0].id;
      await client.query(
        `insert into customers (id, full_name, email, phone)
         values ($1, $2, $3, null)
         on conflict (id) do nothing`,
        [userId, WALK_IN_NAME, WALK_IN_EMAIL]
      );
      const role = await client.query(`select id from roles where code = 'customer'`);
      if (role.rows[0]) {
        await client.query(
          `insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
          [userId, role.rows[0].id]
        );
      }
      console.log("Created walk-in customer", WALK_IN_EMAIL);
    } else {
      console.log("Walk-in customer already exists");
    }

    await client.query("commit");
    console.log("Patched orders.discount_amount + orders.channel");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
