import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Metric tile. Deliberately denser and flatter than the customer cards: admin
 * screens are for scanning numbers, not browsing.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "neutral" | "gold" | "success" | "warning";
}) {
  const tones = {
    neutral: "bg-ink-900 ring-1 ring-white/10",
    gold: "bg-gold-500 text-ink-950",
    success: "bg-green-800 ring-1 ring-green-600",
    warning: "bg-ink-900 ring-1 ring-warning/40",
  } as const;

  const onGold = tone === "gold";

  return (
    <div
      className={cn(
        "rounded-2xl p-4 transition-colors duration-200 sm:p-5",
        tones[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-xs font-bold tracking-wide",
            onGold ? "text-ink-950/70" : "text-white/50",
          )}
        >
          {label}
        </p>
        {icon ? <span className={onGold ? "text-ink-950/70" : "text-gold-400/70"}>{icon}</span> : null}
      </div>
      <p
        className={cn(
          "font-display mt-2 text-2xl font-bold tabular-nums sm:text-3xl",
          onGold ? "text-ink-950" : "text-white",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className={cn("mt-1 text-xs", onGold ? "text-ink-950/60" : "text-white/35")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Bordered panel used for every admin data block. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl bg-ink-900 ring-1 ring-white/10",
        className,
      )}
    >
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-green-800 px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="font-display text-base font-bold text-white">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-white/55">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn("p-1", bodyClassName)}>{children}</div>
    </section>
  );
}
