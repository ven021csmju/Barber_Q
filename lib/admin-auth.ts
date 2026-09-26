import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * A minimal passcode gate for the admin area.
 *
 * There is no Supabase Auth user for staff, and building a real identity system
 * is out of scope for this project. Instead the shop sets ADMIN_PASSCODE and gets
 * one shared passphrase: it is enough to keep the public internet out of the
 * booking table, which is the actual goal. It is deliberately not a substitute
 * for per-user accounts -- if the shop ever needs to know *who* cancelled a
 * booking, this needs to become real auth.
 *
 * The cookie holds an HMAC of a fixed string rather than the passcode itself, so
 * the credential is never sitting in a browser cookie, and comparison is
 * constant-time.
 */

const COOKIE_NAME = "aphidet_admin";
/** 12 hours: long enough for a shift, short enough to not linger. */
const MAX_AGE_SECONDS = 60 * 60 * 12;

function passcode(): string | null {
  const value = process.env.ADMIN_PASSCODE;
  return value && value.length > 0 ? value : null;
}

function token(): string | null {
  const secret = passcode();
  if (!secret) return null;
  return createHmac("sha256", secret).update("aphidet-admin-session").digest("hex");
}

/** Constant-time check of a candidate passcode. */
export function verifyPasscode(candidate: string): boolean {
  const expected = token();
  if (!expected) return false;

  const given = Buffer.from(
    createHmac("sha256", candidate).update("aphidet-admin-session").digest("hex"),
  );
  const want = Buffer.from(expected);

  return given.length === want.length && timingSafeEqual(given, want);
}

export async function isAdminSignedIn(): Promise<boolean> {
  const expected = token();
  if (!expected) return false;

  const store = await cookies();
  const found = store.get(COOKIE_NAME)?.value;
  if (!found) return false;

  const a = Buffer.from(found);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setAdminSession(): Promise<void> {
  const value = token();
  if (!value) return;

  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** True when the operator has not set ADMIN_PASSCODE at all. */
export function isPasscodeUnconfigured(): boolean {
  return passcode() === null;
}
