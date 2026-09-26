"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const FIELD_BASE = cn(
  "w-full rounded-2xl border border-white/10 bg-white/4 px-4 text-base text-white",
  "placeholder:text-white/30",
  "transition-colors duration-200",
  "hover:border-white/20",
  "focus:border-gold-400/60 focus:bg-white/6 focus:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function Field({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: ComponentProps<"input"> & {
  label?: string;
  hint?: string;
  error?: string;
}) {
  const inputId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-white/70"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          FIELD_BASE,
          "h-13",
          error && "border-danger/60 focus:border-danger",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-white/35">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: ComponentProps<"textarea"> & {
  label?: string;
  hint?: string;
  error?: string;
}) {
  const inputId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-white/70"
        >
          {label}
        </label>
      ) : null}
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(
          FIELD_BASE,
          "min-h-24 resize-y py-3 leading-relaxed",
          error && "border-danger/60 focus:border-danger",
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-sm text-white/35">{hint}</p>
      ) : null}
    </div>
  );
}
