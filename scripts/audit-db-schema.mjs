import pg from "pg";

const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/vasritha";

const client = new pg.Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  console.log("Connected:", databaseUrl.replace(/:[^:@/]+@/, ":****@"));

  const tables = await client.query(
    `select tablename from pg_tables where schemaname='public' order by 1`
  );
  console.log("\n=== TABLES (" + tables.rowCount + ") ===");
  console.log(tables.rows.map((r) => r.tablename).join("\n"));

  const focus = [
    "products",
    "orders",
    "inventory_grns",
    "inventory_grn_lines",
    "password_reset_tokens",
    "product_items",
    "categories",
    "suppliers"
  ];
  for (const table of focus) {
    const cols = await client.query(
      `select column_name, data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema='public' and table_name=$1
       order by ordinal_position`,
      [table]
    );
    if (!cols.rowCount) {
      console.log(`\n=== ${table}: MISSING ===`);
      continue;
    }
    console.log(`\n=== ${table} ===`);
    for (const r of cols.rows) {
      console.log(
        `  ${r.column_name} ${r.data_type} ${r.is_nullable === "YES" ? "NULL" : "NOT NULL"} ${r.column_default || ""}`
      );
    }
  }

  const missingComments = await client.query(`
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and obj_description(c.oid, 'pg_class') is null
    order by 1
  `);
  console.log("\n=== TABLES WITHOUT COMMENT (" + missingComments.rowCount + ") ===");
  console.log(missingComments.rows.map((r) => r.table_name).join(", "));

  const looseText = await client.query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema='public'
      and column_name in ('status','type','channel','payment_status')
      and data_type = 'text'
    order by 1,2
  `);
  console.log("\n=== TEXT STATUS-LIKE COLUMNS ===");
  for (const r of looseText.rows) console.log(`  ${r.table_name}.${r.column_name}`);

  const orphanish = await client.query(`
    select
      (select count(*) from products p
        where subcategory_id is not null
          and not exists (
            select 1 from subcategories s
            where s.id = p.subcategory_id and s.category_id = p.category_id
          )) as bad_subcats,
      (select count(*) from products p
        where p.stock_quantity <> coalesce((
          select sum(v.stock_quantity) from product_variants v where v.product_id = p.id
        ),0)) as stock_mismatch
  `);
  console.log("\n=== INTEGRITY CHECKS ===");
  console.log(orphanish.rows[0]);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
