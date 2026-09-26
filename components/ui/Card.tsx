import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "glass" | "solid" | "gold" | "outline";

/** Flat printed surfaces. The previous set used translucent blur panels. */
const TONES: Record<Tone, string> = {
  glass: "bg-ink-850 ring-1 ring-white/10",
  solid: "bg-ink-850 ring-1 ring-white/8 shadow-card",
  gold: "bg-gold-500 text-ink-950",
  outline: "ring-2 ring-gold-500/60 bg-transparent",
};

const RADII = {
  xl: "rounded-2xl",
  "2xl": "rounded-3xl",
  "3xl": "rounded-4xl",
} as const;

export interface CardProps extends ComponentProps<"div"> {
  tone?: Tone;
  radius?: keyof typeof RADII;
  children: ReactNode;
}

export function Card({
  tone = "solid",
  radius = "2xl",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(TONES[tone], RADII[radius], "relative", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
    <div className="min-w-0 space-y-1">
      <h2 className="font-display text-lg font-bold tracking-tight text-white">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-0.5 text-sm text-white/50">{subtitle}</p>
      ) : null}
    </div>
      {action}
    </div>
  );
}
