import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import { createUser, signAccessToken } from "../../../../lib/db/auth";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
    } | null;

    if (!body?.email || !body?.password || !body?.fullName) {
      return fail("email, password and fullName are required");
    }

    const user = await createUser({
      email: body.email,
      password: body.password,
      fullName: body.fullName,
      phone: body.phone
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
