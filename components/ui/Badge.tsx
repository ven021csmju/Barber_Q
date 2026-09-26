import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info" | "gold";

/* Solid sticker fills, matching the poster palette. */
const TONES: Record<BadgeTone, string> = {
  success: "bg-green-600 text-white",
  warning: "bg-gold-500 text-ink-950",
  danger: "bg-danger text-white",
  info: "bg-info text-ink-950",
  neutral: "bg-ink-700 text-white/75",
  gold: "bg-gold-500 text-ink-950",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap uppercase tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-current opacity-90"
        />
      ) : null}
      {children}
    </span>
  );
}
