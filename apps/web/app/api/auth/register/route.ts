import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import { createUser, signAccessToken } from "../../../../lib/db/auth";
import { clientIp, clipText, rateLimit, tooManyRequests } from "../../../../lib/security";

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(`register:${clientIp(request)}`, 8, 60 * 60 * 1000);
    if (!limited.ok) return tooManyRequests(limited.retryAfter);

    const body = (await request.json().catch(() => null)) as {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
    } | null;

    if (!body?.email || !body?.password || !body?.fullName) {
      return fail("email, password and fullName are required");
    }
    if (String(body.password).length < 8) {
      return fail("Password must be at least 8 characters");
    }

    const user = await createUser({
      email: clipText(body.email, 190).toLowerCase(),
      password: body.password,
      fullName: clipText(body.fullName, 120),
      phone: body.phone ? clipText(body.phone, 20) : undefined
    });

    const accessToken = await signAccessToken({ id: user.id, email: user.email });

    return ok(
      {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: "customer"
        },
        session: {
          access_token: accessToken,
          token_type: "bearer"
        }
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    if (message.includes("duplicate") || message.includes("unique")) {
      return fail("Email already registered", 409);
    }
    return fail(message, 400);
  }
}
