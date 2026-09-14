import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../lib/auth/api";
import { queryOne } from "../../../../lib/db/pool";
import {
  deriveStateCode,
  ensureSuppliersSchema,
  listSuppliers,
  nextSupplierCode,
  normalizeGstin,
  normalizePan,
  normalizeSupplierCode,
  validateGstin,
  validatePan,
  type SupplierRow
} from "../../../../lib/suppliers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "1";

  const { error } = activeOnly
    ? await requireAnyPermission(request, [
        "purchases:operate",
        "stock:operate",
        "settings:business"
      ])
    : await requireAnyPermission(request, ["purchases:operate", "settings:business"]);
  if (error) return error;

  await ensureSuppliersSchema();
  const data = await listSuppliers({ activeOnly });
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, [
    "purchases:operate",
    "settings:business"
  ]);
  if (error || !ctx) return error;

  await ensureSuppliersSchema();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.name) return fail("Supplier name is required");

  let code = normalizeSupplierCode(body.code);
  if (!code) {
    code = await nextSupplierCode();
  }

  // Retry once if a race creates a duplicate sequential code
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await queryOne<{ id: string }>(
      `select id from suppliers where lower(code) = lower($1)`,
      [code]
    );
    if (!existing) break;
    if (body.code) return fail(`Supplier code ${code} already exists`);
    code = await nextSupplierCode();
    if (attempt === 2) return fail("Could not allocate a unique supplier code");
  }

  const gstin = normalizeGstin(body.gstin);
  const pan = normalizePan(body.pan);
  const gstErr = validateGstin(gstin);
  if (gstErr) return fail(gstErr);
  const panErr = validatePan(pan);
  if (panErr) return fail(panErr);

  if (gstin) {
    const dupGst = await queryOne<{ id: string }>(
      `select id from suppliers where upper(gstin) = $1`,
      [gstin]
    );
    if (dupGst) return fail("Another supplier already uses this GSTIN");
  }

  const stateCode = deriveStateCode(
    gstin,
    body.state_code != null ? String(body.state_code) : null
  );

  const created = await queryOne<SupplierRow>(
    `insert into suppliers (
       code, name, trade_name, contact_person, phone, email, address, city, state, state_code,
       pincode, gstin, pan, bank_name, bank_account, bank_ifsc, payment_terms, notes, is_active
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
     )
     returning *`,
    [
      code,
      String(body.name).trim(),
      body.trade_name ? String(body.trade_name).trim() : null,
      body.contact_person ? String(body.contact_person).trim() : null,
      body.phone ? String(body.phone).trim() : null,
      body.email ? String(body.email).trim() : null,
      body.address ? String(body.address).trim() : null,
      body.city ? String(body.city).trim() : null,
      body.state ? String(body.state).trim() : null,
      stateCode,
      body.pincode ? String(body.pincode).trim() : null,
      gstin,
      pan,
      body.bank_name ? String(body.bank_name).trim() : null,
      body.bank_account ? String(body.bank_account).trim() : null,
      body.bank_ifsc ? String(body.bank_ifsc).trim().toUpperCase() : null,
      body.payment_terms ? String(body.payment_terms).trim() : null,
      body.notes ? String(body.notes).trim() : null,
      body.is_active === false ? false : true
    ]
  );

  if (!created) return fail("Could not create supplier", 500);

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "suppliers",
    entityId: created.id,
    after: created
  });

  return ok(created, 201);
}
