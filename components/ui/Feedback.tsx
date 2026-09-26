import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Surfaces a real Supabase failure in place of data.
 *
 * Reads never fall back to seed content, so when a query fails this is what
 * the user sees instead of an empty screen. The raw PostgREST message is shown
 * verbatim — an invented "something went wrong" would hide the actual cause,
 * which matters here because the likely cause is an RLS policy that has not
 * been created yet.
 */
export function ReadError({
  error,
  title = "อ่านข้อมูลไม่สำเร็จ",
  className,
}: {
  error: string;
  title?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-3xl border border-danger/25 bg-danger/8 px-4 py-4",
        className,
      )}
    >
      <p className="text-sm font-semibold text-danger">{title}</p>
      <p className="mt-1 font-mono text-xs leading-relaxed break-words text-danger/80">
        {error}
      </p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-shimmer rounded-2xl bg-white/6", className)}
    />
  );
}

export function ServiceCardSkeleton() {
  return (
    <div className="w-64 shrink-0 overflow-hidden rounded-4xl border border-white/8 bg-ink-850/80">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    </div>
  );
}

export function BarberCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-white/8 bg-ink-850/80 p-4">
      <Skeleton className="size-16 rounded-full" />
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Denser layout for panels and table regions. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-4xl border border-dashed border-white/12 bg-white/[0.02] px-6 text-center",
        compact ? "py-8" : "py-12",
        className,
      )}
    >
      <div
        className={cn(
          "grid place-items-center rounded-2xl bg-white/5 text-gold-400/70",
          compact ? "size-11" : "size-14",
        )}
      >
        {icon ?? (
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 3v3m10-3v3M4.5 9.5h15M6 9.5V19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9.5M9.5 13h5"
            />
          </svg>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-white">{title}</p>
        {description ? (
          <p className="mx-auto max-w-64 text-sm leading-relaxed text-white/45">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}
