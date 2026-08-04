import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, publishableKey, serviceRoleKey };
}

export function createPublicSupabaseClient() {
  const { url, publishableKey } = getSupabaseEnv();
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function createServiceSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function createRouteSupabaseClient() {
  const { url, publishableKey } = getSupabaseEnv();
  if (!url || !publishableKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component; ignore.
        }
      }
    }
  });
}

export function createBearerSupabaseClient(accessToken: string) {
  const { url, publishableKey } = getSupabaseEnv();
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
