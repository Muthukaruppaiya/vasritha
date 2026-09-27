import { createHash, randomBytes } from "crypto";
import { query, queryOne } from "./db/pool";
import bcrypt from "bcryptjs";
import { sendMail } from "./mail";
import { skipRuntimeSchemaEnsure } from "./schema-bootstrap";

let schemaReady = false;

export async function ensurePasswordResetSchema() {
  if (schemaReady || skipRuntimeSchemaEnsure()) {
    schemaReady = true;
    return;
  }
  await query(`
    create table if not exists public.password_reset_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.users(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await query(`
    create index if not exists password_reset_tokens_user_idx
      on public.password_reset_tokens (user_id, created_at desc)
  `);
  schemaReady = true;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(input: {
  email: string;
  resetUrlBase: string;
}): Promise<{ ok: true; sent: boolean; skipped?: string } | { ok: false; error: string }> {
  await ensurePasswordResetSchema();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address" };
  }

  const user = await queryOne<{ id: string; email: string; full_name: string }>(
    `select id, email, full_name from users where email = $1`,
    [email]
  );

  // Always succeed outwardly so emails cannot be enumerated.
  if (!user) {
    return { ok: true, sent: false, skipped: "No account" };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await query(
    `update password_reset_tokens set used_at = now()
     where user_id = $1 and used_at is null`,
    [user.id]
  );
  await query(
    `insert into password_reset_tokens (user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt.toISOString()]
  );

  const resetUrl = `${input.resetUrlBase.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const mail = await sendMail({
    to: user.email,
    subject: "Reset your Vasritha password",
    text: [
      `Hi ${user.full_name || "there"},`,
      "",
      "We received a request to reset your Vasritha account password.",
      `Open this link within 1 hour to choose a new password:`,
      resetUrl,
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: `<p>Hi ${user.full_name || "there"},</p>
<p>We received a request to reset your Vasritha account password.</p>
<p><a href="${resetUrl}">Choose a new password</a> (link expires in 1 hour).</p>
<p>If you did not request this, you can ignore this email.</p>`
  });

  return { ok: true, sent: mail.sent, skipped: mail.skipped };
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensurePasswordResetSchema();
  const token = String(input.token || "").trim();
  const password = String(input.password || "");
  if (!token) return { ok: false, error: "Reset link is missing or invalid" };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters" };

  const tokenHash = hashToken(token);
  const row = await queryOne<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    `select id, user_id, expires_at::text, used_at::text
     from password_reset_tokens
     where token_hash = $1
     limit 1`,
    [tokenHash]
  );
  if (!row) return { ok: false, error: "Reset link is invalid or has already been used" };
  if (row.used_at) return { ok: false, error: "Reset link has already been used" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Reset link has expired. Request a new one." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await query(`update users set password_hash = $2, updated_at = now() where id = $1`, [
    row.user_id,
    passwordHash
  ]);
  await query(`update password_reset_tokens set used_at = now() where id = $1`, [row.id]);
  await query(
    `update password_reset_tokens set used_at = now()
     where user_id = $1 and used_at is null`,
    [row.user_id]
  );

  return { ok: true };
}
