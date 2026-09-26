"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn, formatWeekday, shopToday, toISODate, toLocalDate } from "@/lib/utils";

export interface DateOption {
  iso: string;
  day: number;
  weekday: string;
  month: string;
  isToday: boolean;
}

/** Next `days` bookable days starting today. */
export function buildDateOptions(count = 14, from = toLocalDate(shopToday())): DateOption[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(from);
    date.setDate(date.getDate() + i);
    return {
      iso: toISODate(date),
      day: date.getDate(),
      weekday: formatWeekday(toISODate(date)),
      month: new Intl.DateTimeFormat("th-TH", { month: "short" }).format(date),
      isToday: i === 0,
    };
  });
}

export function DateStrip({
  options,
  selected,
  onSelect,
}: {
  options: DateOption[];
  selected: string;
  onSelect: (iso: string) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label="เลือกวันที่"
      className="no-scrollbar -mx-5 flex snap-rail gap-2.5 overflow-x-auto px-5 pb-1"
    >
      {options.map((option) => {
        const active = option.iso === selected;

        return (
          <motion.button
            key={option.iso}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(option.iso)}
            whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className={cn(
              "flex min-h-20 w-[4.25rem] shrink-0 snap-start-item flex-col items-center justify-center gap-0.5 rounded-2xl",
              "transition-[background-color,box-shadow,color] duration-200 ease-out-soft",
              active
                ? "bg-gold-500 text-ink-950 shadow-sticker"
                : "bg-green-800 text-white ring-1 ring-green-600 hover:bg-green-700",
            )}
          >
            <span
              className={cn(
                "text-[0.7rem] font-bold",
                active ? "text-ink-950/60" : "text-white/50",
              )}
            >
              {option.isToday ? "วันนี้" : option.weekday}
            </span>
            <span className="font-display text-xl leading-none font-bold tabular-nums">
              {option.day}
            </span>
            <span
              className={cn(
                "text-[0.7rem] leading-none font-medium",
                active ? "text-ink-950/60" : "text-white/40",
              )}
            >
              {option.month}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
