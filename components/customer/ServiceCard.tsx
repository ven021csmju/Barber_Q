"use client";

import { motion, useReducedMotion } from "motion/react";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn, formatDuration, formatPrice } from "@/lib/utils";
import type { Service } from "@/lib/supabase/types";

/** Small circular tick used by every selectable card. */
export function SelectionCheck({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full transition-all duration-200",
        active
          ? "bg-gold-500 text-ink-950"
          : "border-2 border-dashed border-white/25 text-transparent",
      )}
    >
      {active ? (
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m5 12.5 4.5 4.5L19 7.5"
          />
        </svg>
      ) : null}
    </span>
  );
}

/**
 * Horizontal-rail service card. Fixed width so the rail scrolls rather than
 * wrapping, and the whole card is one large tap target.
 *
 * `image_url` is an optional column that does not exist in the live schema yet;
 * until it is added, `SmartImage` paints the printed poster panel instead of
 * inventing a photo.
 */
export function ServiceCard({
  service,
  selected = false,
  onSelect,
  layout = "rail",
}: {
  service: Service;
  selected?: boolean;
  onSelect?: (service: Service) => void;
  /** `rail` = fixed width in a horizontal scroller; `grid` = full cell. */
  layout?: "rail" | "grid";
}) {
  const reduceMotion = useReducedMotion();

  const body = (
    <>
      <div className="relative overflow-hidden rounded-2xl">
        <SmartImage
          src={service.image_url}
          alt={service.name}
          sizes="(max-width: 480px) 64vw, 280px"
          className="h-40"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-ink-950/90 via-ink-950/20 to-transparent"
        />
        <span className="sticker absolute top-2.5 right-2.5 rounded-full bg-ink-950 px-2.5 py-1 font-display text-[0.7rem] font-bold text-gold-400">
          {formatDuration(service.duration_minutes)}
        </span>
      </div>

      <div className="pt-3">
        <h3 className="font-display text-base leading-snug font-bold text-white">
          {service.name}
        </h3>
        {service.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-white/50">
            {service.description}
          </p>
        ) : null}
        <p className="font-display mt-2 text-2xl font-bold text-gold-500">
          {formatPrice(service.price)}
        </p>
      </div>
    </>
  );

  const frame = cn(
    "rounded-3xl p-3 transition-all duration-200",
    selected
      ? "bg-gold-500/12 ring-2 ring-gold-500"
      : "bg-ink-850 ring-1 ring-white/10 hover:ring-gold-500/50",
  );

  if (onSelect) {
    return (
      <motion.button
        type="button"
        onClick={() => onSelect(service)}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.14, ease: "easeOut" }}
        aria-pressed={selected}
        className={cn(frame, "w-full text-left")}
      >
        {body}
        <span className="mt-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white/55">
            {formatDuration(service.duration_minutes)}
          </span>
          <SelectionCheck active={selected} />
        </span>
      </motion.button>
    );
  }

  return (
    <article
      className={cn(
        frame,
        layout === "rail"
          ? "w-60 shrink-0 snap-start-item sm:w-64"
          : "h-full w-full",
      )}
    >
      {body}
    </article>
  );
}

/** Wide row variant used inside the booking flow (step 1). */
export function ServiceRow({
  service,
  selected,
  onSelect,
}: {
  service: Service;
  selected: boolean;
  onSelect: (service: Service) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(service)}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-4 rounded-3xl p-3 text-left transition-all duration-200",
        selected
          ? "bg-gold-500 text-ink-950 shadow-sticker"
          : "bg-ink-850 ring-1 ring-white/10 hover:ring-gold-500/45",
      )}
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl sm:size-22">
        <SmartImage
          src={service.image_url}
          alt=""
          sizes="88px"
          className="h-full w-full"
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3
          className={cn(
            "font-display truncate text-base font-bold",
            selected ? "text-ink-950" : "text-white",
          )}
        >
          {service.name}
        </h3>
        <p
          className={cn(
            "mt-0.5 text-sm font-medium",
            selected ? "text-ink-950/70" : "text-white/50",
          )}
        >
          {formatDuration(service.duration_minutes)}
        </p>
        <p
          className={cn(
            "font-display mt-1.5 text-lg font-bold",
            selected ? "text-ink-950" : "text-gold-500",
          )}
        >
          {formatPrice(service.price)}
        </p>
      </div>

      {selected ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-950 text-gold-400">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m5 12.5 4.5 4.5L19 7.5"
            />
          </svg>
        </span>
      ) : (
        <SelectionCheck active={false} />
      )}
    </motion.button>
  );
}
