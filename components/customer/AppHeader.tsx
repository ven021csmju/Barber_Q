import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Wordmark used in the header and on the hero. */
export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-sm tracking-[0.2em]",
    md: "text-lg tracking-[0.2em]",
    lg: "text-[1.75rem] leading-none tracking-[0.14em]",
  } as const;

  return (
    <span
      className={cn(
        "font-display font-extrabold text-gradient-gold uppercase",
        sizes[size],
        className,
      )}
    >
      Flook
      <span className="text-white"> Barber</span>
    </span>
  );
}

export function AppHeader({
  title,
  subtitle,
  backHref,
  action,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  backHref?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 -mx-5 mb-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3.5",
        "glass-strong",
        className,
      )}
    >
      {/* Yellow tear-line instead of a hairline border. */}
      <div
        aria-hidden
        className="brush-yellow absolute inset-x-0 bottom-0 h-1 opacity-70"
      />

      <div className="flex items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="ย้อนกลับ"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-500 text-ink-950 transition-transform active:translate-x-[2px] active:translate-y-[2px]"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.5 5.5 8 12l6.5 6.5"
              />
            </svg>
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          {title ? (
            <h1 className="font-display truncate text-xl font-extrabold tracking-tight text-white">
              {title}
            </h1>
          ) : (
            <Link href="/" aria-label="FLOOK BARBER หน้าหลัก">
              <Wordmark />
            </Link>
          )}
          {subtitle ? (
            <p className="truncate text-sm text-white/50">{subtitle}</p>
          ) : null}
        </div>

        {action}
      </div>
    </header>
  );
}
