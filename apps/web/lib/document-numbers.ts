import type { QueryResultRow } from "pg";
import { query, queryOne } from "./db/pool";
import { ensureCompanySettingsSchema } from "./company-settings";
import { skipEnsureIfRelationExists } from "./schema-bootstrap";
import {
  buildDocumentNumber,
  DOC_NUMBER_DEFAULTS,
  prefixForKind,
  previewDocumentNumber,
  resolveDocYearKey,
  sanitizeDocPad,
  sanitizeDocPrefix,
  type DocNumberKind,
  type DocNumberSettings
} from "./document-numbers-format";

export type { DocNumberKind, DocNumberSettings };
export {
  buildDocumentNumber,
  prefixForKind,
  previewDocumentNumber,
  resolveDocYearKey
} from "./document-numbers-format";

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

const DEFAULTS = DOC_NUMBER_DEFAULTS;

let schemaReady: Promise<void> | null = null;

async function runEnsureDocumentNumberSchema() {
  await ensureCompanySettingsSchema();
  await query(`
    alter table public.site_settings
      add column if not exists doc_prefix_invoice text not null default 'VAS',
      add column if not exists doc_prefix_grn text not null default 'GRN',
      add column if not exists doc_prefix_online text not null default 'VAS',
      add column if not exists doc_prefix_product text not null default 'VAS',
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

export async function getDocNumberSettings(): Promise<DocNumberSettings> {
  await ensureDocumentNumberSchema();
  const row = await queryOne<{
    doc_prefix_invoice: string | null;
    doc_prefix_grn: string | null;
    doc_prefix_online: string | null;
    doc_prefix_product: string | null;
    doc_number_pad: number | null;
    doc_number_year_mode: string | null;
  }>(
    `select doc_prefix_invoice, doc_prefix_grn, doc_prefix_online, doc_prefix_product,
            doc_number_pad, doc_number_year_mode
     from site_settings
     limit 1`
  );
  return {
    doc_prefix_invoice: sanitizeDocPrefix(row?.doc_prefix_invoice, DEFAULTS.doc_prefix_invoice),
    doc_prefix_grn: sanitizeDocPrefix(row?.doc_prefix_grn, DEFAULTS.doc_prefix_grn),
    doc_prefix_online: sanitizeDocPrefix(row?.doc_prefix_online, DEFAULTS.doc_prefix_online),
    doc_prefix_product: sanitizeDocPrefix(row?.doc_prefix_product, DEFAULTS.doc_prefix_product),
    doc_number_pad: sanitizeDocPad(row?.doc_number_pad),
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

/** Atomically allocate next number: PREFIX + YEAR + padded sequence (e.g. GRN2026001). */
export async function nextDocumentNumber(kind: DocNumberKind, db?: DbClient) {
  await ensureDocumentNumberSchema();
  const runner = db || { query, queryOne };
  const settings = await getDocNumberSettings();
  const prefix = prefixForKind(settings, kind);
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
