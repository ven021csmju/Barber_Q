"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const ICON = "size-5";

const NAV: NavItem[] = [
  {
    href: "/admin",
    label: "ภาพรวม",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z" />
      </svg>
    ),
  },
  {
    href: "/admin/bookings",
    label: "การจอง",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v3.2M17 3v3.2M3.8 9.4h16.4M5.4 6.2h13.2a1.6 1.6 0 0 1 1.6 1.6v11.4a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6V7.8a1.6 1.6 0 0 1 1.6-1.6Z" />
      </svg>
    ),
  },
  {
    href: "/admin/time-slots",
    label: "ช่วงเวลา",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={1.6}>
        <circle cx="12" cy="12" r="8.2" />
        <path strokeLinecap="round" d="M12 7.4V12l3 1.8" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin shell: a real dashboard frame (persistent rail on desktop, bottom tab bar
 * on mobile) rather than a copy of the customer app. Same palette, different
 * information density.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/8 bg-ink-900 px-4 py-6 lg:flex">
        <Link href="/admin" className="mb-8 flex items-center gap-2.5 px-2">
          <span
            aria-hidden
            className="sticker grid size-9 -rotate-3 place-items-center rounded-xl bg-gold-500 font-display text-sm font-bold text-ink-950"
          >
            A
          </span>
          <span className="min-w-0">
            <span className="font-display block text-sm font-bold tracking-[0.18em] text-white uppercase">
               FLOOK BARBER
            </span>
            <span className="block text-[0.7rem] text-white/40">
              ระบบจัดการร้าน
            </span>
          </span>
        </Link>

        <nav className="flex-1">
          <ul className="space-y-1.5">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition-colors",
                      active ? "text-ink-950" : "text-white/60 hover:bg-green-800 hover:text-white",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="admin-nav-active"
                        aria-hidden
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        className="absolute inset-0 -z-10 rounded-2xl bg-gold-500"
                      />
                    ) : null}
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <Link
          href="/"
          className="mt-4 flex min-h-11 items-center gap-2 rounded-2xl bg-green-800 px-3 text-sm font-medium text-white/70 transition-colors hover:bg-green-700 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.5 8 12l6.5 6.5" />
          </svg>
          กลับหน้าลูกค้า
        </Link>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
          {children}
        </div>
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="เมนูผู้ดูแล"
        className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-white/8 bg-ink-900 px-2 pt-1.5 lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.7rem] font-bold transition-colors",
                    active ? "text-gold-500" : "text-white/45",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-xl transition-colors",
                      active && "bg-gold-500",
                    )}
                  >
                    <span className={active ? "text-ink-950" : undefined}>{item.icon}</span>
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Page header used by every admin route. */
export function AdminHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-white/50">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
