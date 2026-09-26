"use server";

import { redirect } from "next/navigation";
import {
  isPasscodeUnconfigured,
  setAdminSession,
  verifyPasscode,
} from "@/lib/admin-auth";
import type { LoginState } from "@/components/admin/AdminLoginForm";

/**
 * Checks the submitted passcode and opens a session.
 *
 * The comparison inside `verifyPasscode` is constant-time, and the cookie that
 * gets set holds an HMAC rather than the passcode itself.
 */
export async function login(formData: FormData): Promise<LoginState> {
  if (isPasscodeUnconfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า ADMIN_PASSCODE ฝั่งเซิร์ฟเวอร์" };
  }

  const candidate = formData.get("passcode");
  if (typeof candidate !== "string" || !verifyPasscode(candidate)) {
    return { error: "รหัสผ่านไม่ถูกต้อง" };
  }

  await setAdminSession();
  redirect("/admin");
}
