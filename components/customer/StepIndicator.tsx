"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export const BOOKING_STEPS = [
  { key: "service", label: "บริการ" },
  { key: "barber", label: "ช่าง" },
  { key: "date", label: "วันที่" },
  { key: "time", label: "เวลา" },
  { key: "confirm", label: "ยืนยัน" },
] as const;

export type StepKey = (typeof BOOKING_STEPS)[number]["key"];

const pad = (n: number) => String(n + 1).padStart(2, "0");

/**
 * Poster-style progress: five numbered chips on a green rail. Completed steps
 * stay tappable so the customer can jump back and change an earlier choice —
 * that behaviour is unchanged, only the look is.
 */
export function StepIndicator({
  current,
  onJump,
}: {
  current: number;
  onJump?: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <ol className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {BOOKING_STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const reachable = index < current;

          return (
            <li key={step.key} className="shrink-0">
              <button
                type="button"
                disabled={!onJump || !reachable}
                onClick={() => {
                  if (reachable) onJump?.(index);
                }}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold whitespace-nowrap transition-all duration-200",
                  active
                    ? "bg-gold-500 text-ink-950 shadow-sticker"
                    : done
                      ? "bg-green-600 text-white"
                      : "bg-ink-800 text-white/35 ring-1 ring-white/8",
                  onJump && reachable && !active && "hover:bg-green-700",
                )}
              >
                <span
                  className={cn(
                    "font-display text-[0.7rem] tabular-nums",
                    active ? "text-ink-950/60" : "text-current/60",
                  )}
                >
                  {pad(index)}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Bar-chart progress underneath the chips. */}
      <div className="flex items-center gap-1" aria-hidden>
        {BOOKING_STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <motion.span
              key={step.key}
              initial={false}
              animate={{ scaleY: active ? 1.7 : 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "h-1.5 flex-1 origin-center rounded-full transition-colors duration-300",
                done && "bg-green-600",
                active && "bg-gold-500",
                !done && !active && "bg-white/10",
              )}
            />
          );
        })}
      </div>

      <p aria-live="polite" className="text-xs text-white/40">
        ขั้นตอน{" "}
        <span className="font-display font-bold text-gold-500">{pad(current)}</span> /{" "}
        {BOOKING_STEPS.length} · {BOOKING_STEPS[current]?.label}
      </p>
    </div>
  );
}
