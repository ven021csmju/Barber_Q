import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Supabase browser client.
 *
 * Only the *publishable* key is ever read here. Never add a secret /
 * service_role key to a NEXT_PUBLIC_ variable — anything prefixed that way is
 * inlined into the browser bundle.
 *
 * Returns `null` when the env vars are missing so the caller can report a
 * configuration error. There is no seed/mock/fallback dataset anywhere in the
 * booking path: every slot shown to a guest comes from a live Supabase query,
 * so a misconfiguration must be loud rather than silently plausible.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    console.error(
      "[aphidet] Supabase env vars missing — no data can be loaded. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
    return null;
  }

  // The HTTPS project URL is the only valid input. A postgresql:// string here
  // is a misconfiguration (it leaks the DB password to the browser).
  if (!/^https?:\/\//.test(url)) {
    console.error(
      "[aphidet] NEXT_PUBLIC_SUPABASE_URL must be an https:// project URL, not a Postgres connection string.",
    );
    return null;
  }

  return createBrowserClient<Database>(url, publishableKey);
}

let browserClient: ReturnType<typeof createClient> | undefined;

/** Memoised singleton — safe to call from any client component. */
export function getSupabaseClient() {
  if (browserClient === undefined) {
    browserClient = createClient();
  }
  return browserClient;
}
