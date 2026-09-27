import { query } from "./db/pool";
import { skipRuntimeSchemaEnsure } from "./schema-bootstrap";

let ready = false;

export async function ensureOrderCourierSchema() {
  if (ready || skipRuntimeSchemaEnsure()) {
    ready = true;
    return;
  }
  await query(`
    alter table orders
      add column if not exists courier_name text,
      add column if not exists courier_awb text,
      add column if not exists courier_note text
  `);
  ready = true;
}

let restockReady = false;

export async function ensureProductRestockSchema() {
  if (restockReady || skipRuntimeSchemaEnsure()) {
    restockReady = true;
    return;
  }
  await query(`
    alter table products
      add column if not exists restock_expected boolean not null default false
  `);
  restockReady = true;
}
