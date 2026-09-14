import { query, queryOne } from "./db/pool";
import { skipRuntimeSchemaEnsure } from "./schema-bootstrap";
import { stateCodeFromGstin } from "./gst";

export type SupplierRow = {
  id: string;
  code: string;
  name: string;
  trade_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  gstin: string | null;
  pan: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function ensureSuppliersSchema() {
  if (skipRuntimeSchemaEnsure()) return;
  await query(`
    create table if not exists public.suppliers (
      id uuid primary key default gen_random_uuid(),
      code text not null,
      name text not null,
      trade_name text,
      contact_person text,
      phone text,
      email text,
      address text,
      city text,
      state text,
      state_code text,
      pincode text,
      gstin text,
      pan text,
      bank_name text,
      bank_account text,
      bank_ifsc text,
      payment_terms text,
      notes text,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint suppliers_code_nonempty check (length(trim(code)) > 0),
      constraint suppliers_name_nonempty check (length(trim(name)) > 0)
    )
  `);
  await query(`
    create unique index if not exists suppliers_code_unique_idx
      on public.suppliers (lower(code))
  `);
  await query(`
    create unique index if not exists suppliers_gstin_unique_idx
      on public.suppliers (upper(gstin))
      where gstin is not null and length(trim(gstin)) > 0
  `);
  await query(`
    create index if not exists suppliers_active_name_idx
      on public.suppliers (is_active, name)
  `);
  await query(`
    alter table public.inventory_movements
      add column if not exists supplier_id uuid references public.suppliers(id)
  `);
  await query(`
    create index if not exists inventory_movements_supplier_id_idx
      on public.inventory_movements (supplier_id)
      where supplier_id is not null
  `);
}

export function normalizeSupplierCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
}

/** Next sequential supplier code: SUP-0001, SUP-0002, … */
export async function nextSupplierCode() {
  await ensureSuppliersSchema();
  const row = await queryOne<{ max_n: number | null }>(
    `select max(
       case
         when code ~ '^SUP-[0-9]+$' then substring(code from 5)::int
         else null
       end
     )::int as max_n
     from public.suppliers`
  );
  const next = Number(row?.max_n || 0) + 1;
  return `SUP-${String(next).padStart(4, "0")}`;
}

export function normalizeGstin(value: unknown): string | null {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!raw) return null;
  return raw;
}

export function normalizePan(value: unknown): string | null {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!raw) return null;
  return raw;
}

export function validateGstin(gstin: string | null): string | null {
  if (!gstin) return null;
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    return "Enter a valid 15-character GSTIN";
  }
  return null;
}

export function validatePan(pan: string | null): string | null {
  if (!pan) return null;
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    return "Enter a valid 10-character PAN (e.g. ABCDE1234F)";
  }
  return null;
}

export function deriveStateCode(gstin: string | null, explicit?: string | null) {
  const fromBody = String(explicit || "")
    .replace(/\D/g, "")
    .slice(0, 2);
  return fromBody || stateCodeFromGstin(gstin) || null;
}

export async function listSuppliers(options?: { activeOnly?: boolean }) {
  await ensureSuppliersSchema();
  if (options?.activeOnly) {
    return query<SupplierRow>(
      `select * from suppliers where is_active = true order by name asc`
    );
  }
  return query<SupplierRow>(`select * from suppliers order by is_active desc, name asc`);
}

export async function getSupplierById(id: string) {
  await ensureSuppliersSchema();
  return queryOne<SupplierRow>(`select * from suppliers where id = $1`, [id]);
}

export function supplierLabel(supplier: Pick<SupplierRow, "name" | "code" | "gstin" | "trade_name">) {
  const trade = supplier.trade_name?.trim();
  const base = trade && trade !== supplier.name ? `${supplier.name} (${trade})` : supplier.name;
  return `${base} · ${supplier.code}${supplier.gstin ? ` · ${supplier.gstin}` : ""}`;
}
