import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Supabase client for admin work only.
 *
 * Uses SUPABASE_SECRET_KEY, which bypasses RLS. That is precisely why it must
 * never reach the browser: it is imported only from Server Components and
 * Server Actions, `server-only` makes an accidental client import a build
 * error, and the env var deliberately has no NEXT_PUBLIC_ prefix.
 *
 * Every admin route sits behind the passcode session in `lib/admin-auth.ts`, so
 * this powerful client is only ever reached after that check.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    return null;
  }

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Why admin data could not be loaded, phrased for the operator. */
export const ADMIN_KEY_MISSING =
  "ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY ฝั่งเซิร์ฟเวอร์ — ระบบจัดการร้านจึงยังใช้ไม่ได้";
