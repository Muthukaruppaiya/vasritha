import { query, queryOne } from "./db/pool";
import { ensureFinanceSchema } from "./finance";

export type FinanceAccount = {
  id: string;
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "income" | "expense" | string;
  parent_code: string | null;
  is_system: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceCashAccount = {
  id: string;
  code: string;
  name: string;
  kind: "cash" | "bank" | string;
  opening_balance: string | number;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  current_balance?: number;
  total_in?: number;
  total_out?: number;
};

export type FinanceSettings = {
  id: number;
  fy_start_month: number;
  default_cash_account_id: string | null;
  default_bank_account_id: string | null;
  default_sales_account_id: string | null;
  default_purchase_account_id: string | null;
  currency: string;
  updated_at: string;
};

export async function listFinanceAccounts(opts?: { activeOnly?: boolean }) {
  await ensureFinanceSchema();
  if (opts?.activeOnly) {
    return query<FinanceAccount>(
      `select * from finance_accounts where is_active = true order by code`
    );
  }
  return query<FinanceAccount>(`select * from finance_accounts order by code`);
}

export async function createFinanceAccount(input: {
  code: string;
  name: string;
  account_type: string;
  notes?: string | null;
}) {
  await ensureFinanceSchema();
  const code = String(input.code || "").trim();
  const name = String(input.name || "").trim();
  if (!code || !name) throw new Error("Code and name are required");
  const allowed = ["asset", "liability", "equity", "income", "expense"];
  if (!allowed.includes(input.account_type)) throw new Error("Invalid account type");
  const row = await queryOne<FinanceAccount>(
    `insert into finance_accounts (code, name, account_type, notes)
     values ($1, $2, $3, $4)
     returning *`,
    [code, name, input.account_type, input.notes || null]
  );
  if (!row) throw new Error("Failed to create account");
  return row;
}

export async function updateFinanceAccount(
  id: string,
  patch: Partial<{ name: string; notes: string | null; is_active: boolean }>
) {
  await ensureFinanceSchema();
  const row = await queryOne<FinanceAccount>(
    `update finance_accounts set
       name = coalesce($2, name),
       notes = case when $3::boolean then $4 else notes end,
       is_active = coalesce($5, is_active),
       updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      patch.name?.trim() || null,
      patch.notes !== undefined,
      patch.notes ?? null,
      patch.is_active ?? null
    ]
  );
  if (!row) throw new Error("Account not found");
  return row;
}

export async function listCashAccounts(withBalances = true) {
  await ensureFinanceSchema();
  const rows = await query<FinanceCashAccount>(
    `select * from finance_cash_accounts order by kind, code`
  );
  if (!withBalances) return rows;

  const movements = await query<{
    cash_account_id: string;
    direction: string;
    total: string;
  }>(
    `select cash_account_id, direction, coalesce(sum(amount),0)::text as total
     from finance_payment_entries
     where status = 'cleared' and cash_account_id is not null
     group by cash_account_id, direction`
  );
  const map = new Map<string, { inn: number; out: number }>();
  for (const m of movements) {
    const cur = map.get(m.cash_account_id) || { inn: 0, out: 0 };
    if (m.direction === "in") cur.inn = Number(m.total);
    else cur.out = Number(m.total);
    map.set(m.cash_account_id, cur);
  }

  return rows.map((row) => {
    const bal = map.get(row.id) || { inn: 0, out: 0 };
    const opening = Number(row.opening_balance || 0);
    return {
      ...row,
      total_in: bal.inn,
      total_out: bal.out,
      current_balance: Math.round((opening + bal.inn - bal.out + Number.EPSILON) * 100) / 100
    };
  });
}

export async function createCashAccount(input: {
  code: string;
  name: string;
  kind: "cash" | "bank";
  opening_balance?: number;
  notes?: string | null;
}) {
  await ensureFinanceSchema();
  const code = String(input.code || "").trim();
  const name = String(input.name || "").trim();
  if (!code || !name) throw new Error("Code and name are required");
  if (input.kind !== "cash" && input.kind !== "bank") throw new Error("kind must be cash or bank");
  const row = await queryOne<FinanceCashAccount>(
    `insert into finance_cash_accounts (code, name, kind, opening_balance, notes)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [code, name, input.kind, Number(input.opening_balance || 0), input.notes || null]
  );
  if (!row) throw new Error("Failed to create cash account");
  return row;
}

export async function updateCashAccount(
  id: string,
  patch: Partial<{
    name: string;
    opening_balance: number;
    is_active: boolean;
    is_default: boolean;
    notes: string | null;
  }>
) {
  await ensureFinanceSchema();
  if (patch.is_default) {
    const existing = await queryOne<FinanceCashAccount>(
      `select * from finance_cash_accounts where id = $1`,
      [id]
    );
    if (existing) {
      await query(
        `update finance_cash_accounts set is_default = false where kind = $1 and id <> $2`,
        [existing.kind, id]
      );
    }
  }
  const row = await queryOne<FinanceCashAccount>(
    `update finance_cash_accounts set
       name = coalesce($2, name),
       opening_balance = coalesce($3, opening_balance),
       is_active = coalesce($4, is_active),
       is_default = coalesce($5, is_default),
       notes = case when $6::boolean then $7 else notes end,
       updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      patch.name?.trim() || null,
      patch.opening_balance ?? null,
      patch.is_active ?? null,
      patch.is_default ?? null,
      patch.notes !== undefined,
      patch.notes ?? null
    ]
  );
  if (!row) throw new Error("Cash account not found");
  return row;
}

export async function getFinanceSettings() {
  await ensureFinanceSchema();
  let row = await queryOne<FinanceSettings>(`select * from finance_settings where id = 1`);
  if (!row) {
    await query(`insert into finance_settings (id) values (1) on conflict do nothing`);
    row = await queryOne<FinanceSettings>(`select * from finance_settings where id = 1`);
  }
  if (!row) throw new Error("Finance settings missing");
  return row;
}

export async function updateFinanceSettings(
  patch: Partial<{
    fy_start_month: number;
    default_cash_account_id: string | null;
    default_bank_account_id: string | null;
    default_sales_account_id: string | null;
    default_purchase_account_id: string | null;
    currency: string;
  }>
) {
  await ensureFinanceSchema();
  const row = await queryOne<FinanceSettings>(
    `update finance_settings set
       fy_start_month = coalesce($2, fy_start_month),
       default_cash_account_id = case when $3::boolean then $4 else default_cash_account_id end,
       default_bank_account_id = case when $5::boolean then $6 else default_bank_account_id end,
       default_sales_account_id = case when $7::boolean then $8 else default_sales_account_id end,
       default_purchase_account_id = case when $9::boolean then $10 else default_purchase_account_id end,
       currency = coalesce($11, currency),
       updated_at = now()
     where id = 1
     returning *`,
    [
      1,
      patch.fy_start_month ?? null,
      patch.default_cash_account_id !== undefined,
      patch.default_cash_account_id ?? null,
      patch.default_bank_account_id !== undefined,
      patch.default_bank_account_id ?? null,
      patch.default_sales_account_id !== undefined,
      patch.default_sales_account_id ?? null,
      patch.default_purchase_account_id !== undefined,
      patch.default_purchase_account_id ?? null,
      patch.currency?.trim() || null
    ]
  );
  if (!row) throw new Error("Failed to update settings");
  return row;
}
