import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import {
  deriveStateCode,
  ensureSuppliersSchema,
  getSupplierById,
  normalizeGstin,
  normalizePan,
  normalizeSupplierCode,
  validateGstin,
  validatePan,
  type SupplierRow
} from "../../../../../lib/suppliers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const { error } = await requireAnyPermission(request, [
    "purchases:operate",
    "stock:operate",
    "settings:business"
  ]);
  if (error) return error;

  const { id } = await context.params;
  const row = await getSupplierById(id);
  if (!row) return fail("Supplier not found", 404);
  return ok(row);
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const { error, ctx } = await requireAnyPermission(request, [
    "purchases:operate",
    "settings:business"
  ]);
  if (error || !ctx) return error;

  await ensureSuppliersSchema();
  const { id } = await context.params;
  const existing = await getSupplierById(id);
  if (!existing) return fail("Supplier not found", 404);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Invalid body");

  const nextCode =
    body.code != null ? normalizeSupplierCode(body.code) : existing.code;
  if (!nextCode) return fail("Supplier code is required");

  if (nextCode.toLowerCase() !== existing.code.toLowerCase()) {
    const clash = await queryOne<{ id: string }>(
      `select id from suppliers where lower(code) = lower($1) and id <> $2`,
      [nextCode, id]
    );
    if (clash) return fail(`Supplier code ${nextCode} already exists`);
  }

  const gstin =
    body.gstin !== undefined ? normalizeGstin(body.gstin) : existing.gstin;
  const pan = body.pan !== undefined ? normalizePan(body.pan) : existing.pan;
  const gstErr = validateGstin(gstin);
  if (gstErr) return fail(gstErr);
  const panErr = validatePan(pan);
  if (panErr) return fail(panErr);

  if (gstin) {
    const dupGst = await queryOne<{ id: string }>(
      `select id from suppliers where upper(gstin) = $1 and id <> $2`,
      [gstin, id]
    );
    if (dupGst) return fail("Another supplier already uses this GSTIN");
  }

  const stateCode = deriveStateCode(
    gstin,
    body.state_code !== undefined
      ? body.state_code == null
        ? null
        : String(body.state_code)
      : existing.state_code
  );

  const updated = await queryOne<SupplierRow>(
    `update suppliers set
       code = $2,
       name = $3,
       trade_name = $4,
       contact_person = $5,
       phone = $6,
       email = $7,
       address = $8,
       city = $9,
       state = $10,
       state_code = $11,
       pincode = $12,
       gstin = $13,
       pan = $14,
       bank_name = $15,
       bank_account = $16,
       bank_ifsc = $17,
       payment_terms = $18,
       notes = $19,
       is_active = $20,
       updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      nextCode,
      body.name != null ? String(body.name).trim() : existing.name,
      body.trade_name !== undefined
        ? body.trade_name
          ? String(body.trade_name).trim()
          : null
        : existing.trade_name,
      body.contact_person !== undefined
        ? body.contact_person
          ? String(body.contact_person).trim()
          : null
        : existing.contact_person,
      body.phone !== undefined
        ? body.phone
          ? String(body.phone).trim()
          : null
        : existing.phone,
      body.email !== undefined
        ? body.email
          ? String(body.email).trim()
          : null
        : existing.email,
      body.address !== undefined
        ? body.address
          ? String(body.address).trim()
          : null
        : existing.address,
      body.city !== undefined
        ? body.city
          ? String(body.city).trim()
          : null
        : existing.city,
      body.state !== undefined
        ? body.state
          ? String(body.state).trim()
          : null
        : existing.state,
      stateCode,
      body.pincode !== undefined
        ? body.pincode
          ? String(body.pincode).trim()
          : null
        : existing.pincode,
      gstin,
      pan,
      body.bank_name !== undefined
        ? body.bank_name
          ? String(body.bank_name).trim()
          : null
        : existing.bank_name,
      body.bank_account !== undefined
        ? body.bank_account
          ? String(body.bank_account).trim()
          : null
        : existing.bank_account,
      body.bank_ifsc !== undefined
        ? body.bank_ifsc
          ? String(body.bank_ifsc).trim().toUpperCase()
          : null
        : existing.bank_ifsc,
      body.payment_terms !== undefined
        ? body.payment_terms
          ? String(body.payment_terms).trim()
          : null
        : existing.payment_terms,
      body.notes !== undefined
        ? body.notes
          ? String(body.notes).trim()
          : null
        : existing.notes,
      body.is_active === false ? false : body.is_active === true ? true : existing.is_active
    ]
  );

  if (!updated) return fail("Could not update supplier", 500);

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "suppliers",
    entityId: id,
    before: existing,
    after: updated
  });

  return ok(updated);
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const { error, ctx } = await requireAnyPermission(request, [
    "purchases:operate",
    "settings:business"
  ]);
  if (error || !ctx) return error;

  await ensureSuppliersSchema();
  const { id } = await context.params;
  const existing = await getSupplierById(id);
  if (!existing) return fail("Supplier not found", 404);

  const usage = await queryOne<{ c: number }>(
    `select count(*)::int as c from inventory_movements where supplier_id = $1`,
    [id]
  );

  if (Number(usage?.c || 0) > 0) {
    const deactivated = await queryOne<SupplierRow>(
      `update suppliers set is_active = false, updated_at = now() where id = $1 returning *`,
      [id]
    );
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "deactivate",
      entityType: "suppliers",
      entityId: id,
      before: existing,
      after: deactivated
    });
    return ok(deactivated);
  }

  await query(`delete from suppliers where id = $1`, [id]);
  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "suppliers",
    entityId: id,
    before: existing
  });
  return ok({ deleted: true });
}
