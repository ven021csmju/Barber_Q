"use client";

import { useState } from "react";
import { AppHeader, Wordmark } from "@/components/customer/AppHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FadeIn } from "@/components/motion/FadeIn";
import { cn } from "@/lib/utils";
import type { Customer } from "@/lib/supabase/types";

const MENU = [
  {
    key: "bookings",
    label: "การจองของฉัน",
    description: "ดูคิวที่จองไว้ ยืนยัน หรือยกเลิก",
    href: "/bookings",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3v3.2M17 3v3.2M3.8 9.4h16.4M5.4 6.2h13.2a1.6 1.6 0 0 1 1.6 1.6v11.4a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6V7.8a1.6 1.6 0 0 1 1.6-1.6Z"
      />
    ),
  },
  {
    key: "book",
    label: "จองคิวใหม่",
    description: "เลือกบริการ ช่าง วันและเวลา",
    href: "/booking",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 5.4v13.2M5.4 12h13.2"
      />
    ),
  },
  {
    key: "edit",
    label: "แก้ไขข้อมูล",
    description: "ชื่อ เบอร์โทร และอีเมล",
    href: "/profile#edit",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 20h4.2L19 9.2a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8z"
      />
    ),
  },
] as const;

export function ProfileView({ customer }: { customer: Customer }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({
    full_name: customer.full_name,
    phone: customer.phone,
    email: customer.email ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (!values.full_name.trim()) next.full_name = "กรุณากรอกชื่อของคุณ";
    if (!/^0\d{1,2}-?\d{3}-?\d{4}$/.test(values.phone.trim()))
      next.phone = "รูปแบบเบอร์โทรไม่ถูกต้อง เช่น 081-234-5678";
    if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim()))
      next.email = "รูปแบบอีเมลไม่ถูกต้อง";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <div>
      <AppHeader title="โปรไฟล์" />

      <FadeIn>
        {/* Identity card */}
        <div className="relative overflow-hidden rounded-5xl bg-green-800 p-5 ring-1 ring-gold-500/30">
          <div aria-hidden className="halftone absolute inset-0 opacity-[0.08]" />
          <div className="relative flex items-center gap-4">
            <div
              aria-hidden
              className="sticker grid size-16 shrink-0 -rotate-3 place-items-center rounded-full bg-gold-500 font-display text-2xl font-bold text-ink-950"
            >
              {customer.full_name.trim().charAt(0) || "A"}
            </div>
            <div className="min-w-0">
              <p className="font-display truncate text-lg font-bold text-white">
                {customer.full_name}
              </p>
              <p className="truncate text-sm text-white/60">{customer.phone}</p>
              <Wordmark size="sm" className="mt-1 block text-[0.65rem] opacity-70" />
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Details / edit */}
      <FadeIn delay={0.08} className="mt-5">
        <section id="edit" className="rounded-4xl bg-ink-900 p-5 ring-1 ring-white/10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-white">ข้อมูลส่วนตัว</h2>
            <button
              type="button"
              onClick={() => {
                setEditing((v) => !v);
                setSaved(false);
                setErrors({});
              }}
              className="sticker rounded-full bg-gold-500 px-3.5 py-1.5 font-display text-sm font-bold text-ink-950 transition-transform hover:rotate-2"
            >
              {editing ? "ยกเลิก" : "แก้ไขข้อมูล"}
            </button>
          </div>

          {editing ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!validate()) return;
                setEditing(false);
                setSaved(true);
              }}
            >
              <Field
                label="ชื่อ"
                name="full_name"
                autoComplete="name"
                value={values.full_name}
                error={errors.full_name}
                onChange={(e) =>
                  setValues((v) => ({ ...v, full_name: e.target.value }))
                }
              />
              <Field
                label="เบอร์โทร"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={values.phone}
                error={errors.phone}
                onChange={(e) =>
                  setValues((v) => ({ ...v, phone: e.target.value }))
                }
              />
              <Field
                label="อีเมล"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={values.email}
                error={errors.email}
                onChange={(e) =>
                  setValues((v) => ({ ...v, email: e.target.value }))
                }
              />
              <Button type="submit" fullWidth>
                บันทึกข้อมูล
              </Button>
            </form>
          ) : (
            <dl className="space-y-0">
              {[
                ["ชื่อ", customer.full_name],
                ["เบอร์โทร", customer.phone],
                ["อีเมล", customer.email ?? "ยังไม่ได้กรอก"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-white/8 py-3.5 last:border-b-0"
                >
                  <dt className="text-sm text-white/50">{label}</dt>
                  <dd
                    className={cn(
                      "font-display truncate text-[0.95rem] font-bold",
                      value === "ยังไม่ได้กรอก"
                        ? "text-white/30"
                        : "text-white",
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {saved ? (
            <p
              role="status"
              className="mt-4 rounded-2xl bg-success/15 px-4 py-3 text-sm font-medium text-success"
            >
              บันทึกข้อมูลเรียบร้อยแล้ว
            </p>
          ) : null}
        </section>
      </FadeIn>

      {/* Menu */}
      <FadeIn delay={0.14} className="mt-5">
        <nav aria-label="เมนูโปรไฟล์" className="space-y-2.5">
          {MENU.filter((item) => item.key !== "edit").map((item) => (
            <a
              key={item.key}
              href={item.href}
              className="flex items-center gap-4 rounded-3xl bg-ink-900 p-4 ring-1 ring-white/10 transition-all hover:ring-gold-500/50 hover:rotate-[-0.5deg]"
            >
              <span
                aria-hidden
                className="grid size-11 shrink-0 place-items-center rounded-2xl bg-green-800 text-gold-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                >
                  {item.icon}
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.95rem] font-medium text-white">
                  {item.label}
                </span>
                <span className="block truncate text-sm text-white/40">
                  {item.description}
                </span>
              </span>
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="size-5 shrink-0 text-white/25"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m9.5 5.5 6.5 6.5-6.5 6.5"
                />
              </svg>
            </a>
          ))}
        </nav>
      </FadeIn>

      <FadeIn delay={0.2} className="mt-5">
        <p className="text-center text-xs text-white/25">
          FLOOK BARBER
        </p>
      </FadeIn>
    </div>
  );
}
