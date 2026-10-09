import type { QueryResultRow } from "pg";
import { query, queryOne } from "./db/pool";
import { ensureCompanySettingsSchema } from "./company-settings";
import { skipEnsureIfRelationExists } from "./schema-bootstrap";

export type DocNumberKind = "invoice" | "grn" | "online";

export type DocNumberSettings = {
  doc_prefix_invoice: string;
  doc_prefix_grn: string;
  doc_prefix_online: string;
  doc_number_pad: number;
  doc_number_year_mode: "calendar" | "fy";
};

type DbClient = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<T[]>;
  queryOne: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<T | null>;
};

const DEFAULTS: DocNumberSettings = {
  doc_prefix_invoice: "VAS",
  doc_prefix_grn: "GRN",
  doc_prefix_online: "VAS",
  doc_number_pad: 3,
  doc_number_year_mode: "calendar"
};

let schemaReady: Promise<void> | null = null;

async function runEnsureDocumentNumberSchema() {
  await ensureCompanySettingsSchema();
  await query(`
    alter table public.site_settings
      add column if not exists doc_prefix_invoice text not null default 'VAS',
      add column if not exists doc_prefix_grn text not null default 'GRN',
      add column if not exists doc_prefix_online text not null default 'VAS',
      add column if not exists doc_number_pad integer not null default 3,
      add column if not exists doc_number_year_mode text not null default 'calendar'
  `);

  if (!(await skipEnsureIfRelationExists("public.document_number_sequences"))) {
    await query(`
      create table if not exists public.document_number_sequences (
        kind text not null,
        year_key text not null,
        last_n integer not null default 0,
        updated_at timestamptz not null default now(),
        primary key (kind, year_key)
      )
    `);
  }
}

export async function ensureDocumentNumberSchema() {
  if (!schemaReady) {
    schemaReady = runEnsureDocumentNumberSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function sanitizePrefix(raw: string | null | undefined, fallback: string) {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return cleaned || fallback;
}

function sanitizePad(raw: unknown) {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return DEFAULTS.doc_number_pad;
  return Math.min(8, Math.max(2, n));
}

export function resolveDocYearKey(
  mode: "calendar" | "fy",
  now = new Date(),
  fyStartMonth = 4
): string {
  if (mode !== "fy") return String(now.getFullYear());
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const start = Math.min(12, Math.max(1, Math.trunc(fyStartMonth) || 4));
  // Indian FY: Apr–Mar → year key is the FY starting calendar year.
  return String(month >= start ? year : year - 1);
}

export function buildDocumentNumber(prefix: string, yearKey: string, seq: number, pad: number) {
  const safePad = sanitizePad(pad);
  const safePrefix = sanitizePrefix(prefix, "DOC");
  return `${safePrefix}${yearKey}-${String(Math.max(1, seq)).padStart(safePad, "0")}`;
}

export function previewDocumentNumber(
  settings: Partial<DocNumberSettings>,
  kind: DocNumberKind,
  seq = 1,
  now = new Date()
) {
  const prefix =
    kind === "grn"
      ? sanitizePrefix(settings.doc_prefix_grn, DEFAULTS.doc_prefix_grn)
      : kind === "online"
        ? sanitizePrefix(settings.doc_prefix_online, DEFAULTS.doc_prefix_online)
        : sanitizePrefix(settings.doc_prefix_invoice, DEFAULTS.doc_prefix_invoice);
  const mode = settings.doc_number_year_mode === "fy" ? "fy" : "calendar";
  const yearKey = resolveDocYearKey(mode, now);
  return buildDocumentNumber(prefix, yearKey, seq, sanitizePad(settings.doc_number_pad));
}

export async function getDocNumberSettings(): Promise<DocNumberSettings> {
  await ensureDocumentNumberSchema();
  const row = await queryOne<{
    doc_prefix_invoice: string | null;
    doc_prefix_grn: string | null;
    doc_prefix_online: string | null;
    doc_number_pad: number | null;
    doc_number_year_mode: string | null;
  }>(
    `select doc_prefix_invoice, doc_prefix_grn, doc_prefix_online,
            doc_number_pad, doc_number_year_mode
     from site_settings
     limit 1`
  );
  return {
    doc_prefix_invoice: sanitizePrefix(row?.doc_prefix_invoice, DEFAULTS.doc_prefix_invoice),
    doc_prefix_grn: sanitizePrefix(row?.doc_prefix_grn, DEFAULTS.doc_prefix_grn),
    doc_prefix_online: sanitizePrefix(row?.doc_prefix_online, DEFAULTS.doc_prefix_online),
    doc_number_pad: sanitizePad(row?.doc_number_pad),
    doc_number_year_mode: row?.doc_number_year_mode === "fy" ? "fy" : "calendar"
  };
}

async function resolveFyStartMonth(db?: DbClient) {
  const runner = db || { query, queryOne };
  try {
    const row = await runner.queryOne<{ fy_start_month: number | null }>(
      `select fy_start_month from finance_settings limit 1`
    );
    return Number(row?.fy_start_month) || 4;
  } catch {
    return 4;
  }
}

/** Atomically allocate next number: PREFIX + YEAR + - + padded sequence. */
export async function nextDocumentNumber(kind: DocNumberKind, db?: DbClient) {
  await ensureDocumentNumberSchema();
  const runner = db || { query, queryOne };
  const settings = await getDocNumberSettings();
  const prefix =
    kind === "grn"
      ? settings.doc_prefix_grn
      : kind === "online"
        ? settings.doc_prefix_online
        : settings.doc_prefix_invoice;
  const fyStart = await resolveFyStartMonth(db);
  const yearKey = resolveDocYearKey(settings.doc_number_year_mode, new Date(), fyStart);

  const seqRow = await runner.queryOne<{ last_n: number }>(
    `insert into document_number_sequences (kind, year_key, last_n, updated_at)
     values ($1, $2, 1, now())
     on conflict (kind, year_key)
     do update set last_n = document_number_sequences.last_n + 1, updated_at = now()
     returning last_n`,
    [kind, yearKey]
  );
  const seq = Number(seqRow?.last_n || 1);
  return buildDocumentNumber(prefix, yearKey, seq, settings.doc_number_pad);
}
