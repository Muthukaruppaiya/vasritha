import { query, queryOne } from "./db/pool";
import { skipEnsureIfRelationExists } from "./schema-bootstrap";

export type ProductColour = {
  id: string;
  name: string;
  hex: string | null;
  sort_order: number;
  is_active: boolean;
};

const DEFAULT_COLOURS: Array<{ name: string; hex: string; sort: number }> = [
  { name: "Crimson Red", hex: "#B91C1C", sort: 10 },
  { name: "Blush Pink", hex: "#F9A8D4", sort: 20 },
  { name: "Ivory Cream", hex: "#FFF8E7", sort: 30 },
  { name: "Indigo Blue", hex: "#3730A3", sort: 40 },
  { name: "Antique Gold", hex: "#C9A227", sort: 50 },
  { name: "Gold", hex: "#D4AF37", sort: 60 },
  { name: "Maroon", hex: "#7F1D1D", sort: 70 },
  { name: "Emerald Green", hex: "#047857", sort: 80 },
  { name: "Black", hex: "#111827", sort: 90 },
  { name: "White", hex: "#F8FAFC", sort: 100 },
  { name: "Natural Wood", hex: "#A16207", sort: 110 },
  { name: "Antique Brass", hex: "#B45309", sort: 120 }
];

let coloursSchemaReady: Promise<void> | null = null;

async function runEnsureColoursSchema() {
  await query(`
    create table if not exists public.product_colours (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      hex text,
      sort_order integer not null default 100,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query(`
    create unique index if not exists product_colours_name_lower_uidx
      on public.product_colours (lower(name))
  `);

  const count = await queryOne<{ c: number }>(
    `select count(*)::int as c from public.product_colours`
  );
  if (!Number(count?.c || 0)) {
    for (const colour of DEFAULT_COLOURS) {
      await query(
        `insert into public.product_colours (name, hex, sort_order)
         select $1, $2, $3
         where not exists (
           select 1 from public.product_colours where lower(name) = lower($1)
         )`,
        [colour.name, colour.hex, colour.sort]
      );
    }
  }
}

export async function ensureColoursSchema() {
  if (await skipEnsureIfRelationExists("public.product_colours")) {
    // Still seed if empty (hosted skip path).
    const count = await queryOne<{ c: number }>(
      `select count(*)::int as c from public.product_colours`
    ).catch(() => null);
    if (count && Number(count.c) === 0) {
      for (const colour of DEFAULT_COLOURS) {
        await query(
          `insert into public.product_colours (name, hex, sort_order)
           select $1, $2, $3
           where not exists (
             select 1 from public.product_colours where lower(name) = lower($1)
           )`,
          [colour.name, colour.hex, colour.sort]
        ).catch(() => null);
      }
    }
    return;
  }
  if (!coloursSchemaReady) {
    coloursSchemaReady = runEnsureColoursSchema().catch((error) => {
      coloursSchemaReady = null;
      throw error;
    });
  }
  return coloursSchemaReady;
}

export async function listProductColours(opts?: { activeOnly?: boolean; q?: string }) {
  await ensureColoursSchema();
  const params: unknown[] = [];
  const where: string[] = [];
  if (opts?.activeOnly !== false) {
    where.push(`is_active = true`);
  }
  if (opts?.q?.trim()) {
    params.push(`%${opts.q.trim()}%`);
    where.push(`name ilike $${params.length}`);
  }
  const sql = `
    select id, name, hex, sort_order, is_active
    from public.product_colours
    ${where.length ? `where ${where.join(" and ")}` : ""}
    order by sort_order asc, name asc
  `;
  return query<ProductColour>(sql, params);
}

/** Upsert a colour name so free-typed values become master data. */
export async function ensureColourName(name: string, hex?: string | null) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  await ensureColoursSchema();
  const existing = await queryOne<ProductColour>(
    `select id, name, hex, sort_order, is_active
     from public.product_colours
     where lower(name) = lower($1)
     limit 1`,
    [trimmed]
  );
  if (existing) {
    if (!existing.is_active) {
      await query(
        `update public.product_colours set is_active = true, updated_at = now() where id = $1`,
        [existing.id]
      );
    }
    return existing;
  }
  return queryOne<ProductColour>(
    `insert into public.product_colours (name, hex, sort_order)
     values ($1, $2, 500)
     returning id, name, hex, sort_order, is_active`,
    [trimmed, hex || null]
  );
}
