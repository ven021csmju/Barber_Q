"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export interface LoginState {
  error: string | null;
}

/** Submit button that reflects the pending state of its own form. */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth loading={pending}>
      เข้าสู่ระบบ
    </Button>
  );
}

/**
 * Shared-passcode sign-in.
 *
 * There are no staff accounts, so this is a single passphrase held by the shop.
 * It is enough to keep guests out of the booking table; it does not identify
 * which staff member signed in.
 */
export function AdminLoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(
    async (_prev, formData) => {
      const { login } = await import("@/app/admin/(dash)/login-action");
      return login(formData);
    },
    { error: null },
  );

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-green-800 p-5">
          <p className="font-display text-[0.7rem] font-bold tracking-[0.3em] text-gold-400 uppercase">
            FLOOK BARBER
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold text-white">ระบบจัดการร้าน</h1>
          <p className="mt-1 text-sm text-white/60">สำหรับผู้ดูแลร้านเท่านั้น</p>
        </div>

        <form
          action={formAction}
          className="mt-4 space-y-4 rounded-3xl bg-ink-900 p-5 ring-1 ring-white/10"
        >
          <div>
            <label
              htmlFor="passcode"
              className="font-display block text-sm font-bold text-white"
            >
              รหัสผ่าน
            </label>
            <input
              id="passcode"
              name="passcode"
              type="password"
              autoComplete="current-password"
              autoFocus
              aria-invalid={state.error ? true : undefined}
              className="mt-1.5 min-h-12 w-full rounded-2xl bg-ink-800 px-4 text-base text-white ring-1 ring-white/12 focus:ring-2 focus:ring-gold-500 focus:outline-none"
            />
          </div>

          {state.error ? (
            <p role="alert" className="rounded-2xl bg-danger/15 px-4 py-3 text-sm font-bold text-danger">
              {state.error}
            </p>
          ) : null}

          <SubmitButton />
        </form>

        <p className="mt-4 text-center text-xs text-white/30">
          <Link href="/" className="underline underline-offset-4 hover:text-white/60">
            ??????????????
          </Link>
        </p>
      </div>
    </div>
  );
}
