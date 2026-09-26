"use client";

import Link from "next/link";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "gold" | "glass" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

/**
 * Flat, high-contrast poster fills. No blur, no glass, no gradient sheen —
 * a printed sticker with a hard shadow.
 */
const VARIANTS: Record<Variant, string> = {
  gold: "bg-gold-500 text-ink-950 shadow-sticker hover:bg-gold-400 active:shadow-none",
  glass: "bg-ink-800 text-white ring-1 ring-white/12 hover:bg-ink-750 active:bg-ink-700",
  outline:
    "ring-2 ring-gold-500/70 text-gold-400 hover:bg-gold-500 hover:text-ink-950 active:bg-gold-600",
  ghost: "text-white/65 hover:bg-white/8 hover:text-white active:bg-white/12",
  danger: "bg-danger text-white shadow-sticker hover:brightness-110 active:shadow-none",
};

/** Every size clears the 44px minimum touch target. */
const SIZES: Record<Size, string> = {
  sm: "h-11 gap-1.5 rounded-xl px-4 text-sm",
  md: "h-13 gap-2 rounded-2xl px-5 text-[0.95rem]",
  lg: "h-15 gap-2.5 rounded-2xl px-6 text-base",
};

const BASE = cn(
  "relative inline-flex select-none items-center justify-center",
  "font-bold tracking-tight whitespace-nowrap",
  "transition-[transform,background-color,color,box-shadow,opacity] duration-150 ease-out-soft",
  "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  "disabled:pointer-events-none disabled:opacity-40",
);

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

function Label({
  children,
  loading,
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <>
      {loading ? (
        <span
          aria-hidden
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      <span className={cn("relative", loading && "opacity-80")}>{children}</span>
    </>
  );
}

export type ButtonProps = CommonProps &
  Omit<HTMLMotionProps<"button">, "children" | "className"> & {
    loading?: boolean;
  };

export function Button({
  variant = "gold",
  size = "md",
  fullWidth,
  className,
  children,
  loading,
  disabled,
  ...props
}: ButtonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      <Label loading={loading}>{children}</Label>
    </motion.button>
  );
}

export type ButtonLinkProps = CommonProps &
  Omit<React.ComponentProps<typeof Link>, "children" | "className">;

export function ButtonLink({
  variant = "gold",
  size = "md",
  fullWidth,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
