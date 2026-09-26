"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * One time slot. Booked slots stay visible but are disabled and struck through
 * so the grid layout never shifts.
 */
export function TimeSlotButton({
  time,
  booked = false,
  selected = false,
  onSelect,
  disabled = false,
}: {
  time: string;
  booked?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelect: (time: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const isDisabled = booked || disabled;

  return (
    <motion.button
      type="button"
      disabled={isDisabled}
      onClick={() => onSelect(time)}
      whileTap={reduceMotion || isDisabled ? undefined : { scale: 0.95 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      aria-pressed={selected}
      aria-label={booked ? `${time} จองแล้ว` : time}
      className={cn(
        "relative flex min-h-14 flex-col items-center justify-center rounded-2xl px-2 py-2.5",
        "transition-[transform,background-color,box-shadow,color] duration-200 ease-out-soft",
        isDisabled && "cursor-not-allowed",
        selected
          ? "bg-gold-500 text-ink-950 shadow-sticker"
          : booked
            ? "bg-ink-750 text-white/25"
            : "bg-green-800 text-white ring-1 ring-green-600 hover:bg-green-700 active:scale-[0.96]",
      )}
    >
      <span
        className={cn(
          "font-display text-base font-bold tabular-nums",
          booked && "line-through decoration-white/30",
        )}
      >
        {time}
      </span>
      <span
        className={cn(
          "mt-0.5 text-[0.65rem] leading-none font-bold",
          selected ? "text-ink-950/60" : booked ? "text-white/30" : "text-gold-400/80",
        )}
      >
        {booked ? "จองแล้ว" : selected ? "เลือกแล้ว" : "ว่าง"}
      </span>
    </motion.button>
  );
}
