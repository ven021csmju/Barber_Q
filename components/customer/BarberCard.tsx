"use client";

import { motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/Badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { SelectionCheck } from "./ServiceCard";
import { barberStatusMeta, cn } from "@/lib/utils";
import type { Barber } from "@/lib/supabase/types";

/**
 * The real `barbers` row is only id/name/phone/status/created_at, so there is
 * no role, bio, rating or avatar column. `status` is free-form text, so every
 * lookup goes through the tolerant mapping in lib/utils.
 */
function StatusDot({ status }: { status: string }) {
  const key = status.trim().toLowerCase();
  const known = ["available", "busy", "off", ""];
  return (
    <span
      aria-hidden
      className={cn(
        "absolute right-0 bottom-0 size-4 rounded-full border-[3px] border-ink-850",
        key === "available" && "bg-gold-500",
        key === "busy" && "bg-danger",
        (key === "off" || key === "") && "bg-ink-600",
        !known.includes(key) && "bg-green-500",
      )}
    />
  );
}

function Avatar({
  barber,
  decorative,
  className,
}: {
  barber: Barber;
  decorative?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl ring-2 ring-gold-500/40",
        className,
      )}
    >
      <SmartImage
        src={barber.avatar_url}
        alt={decorative ? "" : barber.name}
        sizes="80px"
        className="h-full w-full"
      />
      <StatusDot status={barber.status ?? ""} />
    </div>
  );
}

/** Compact card for the home-page "ช่างของเรา" rail. */
export function BarberCard({
  barber,
  onSelect,
}: {
  barber: Barber;
  onSelect?: (barber: Barber) => void;
}) {
  const status = barberStatusMeta(barber.status);
  const selectable = (barber.status ?? "").trim().toLowerCase() !== "off";

  return (
    <button
      type="button"
      onClick={onSelect ? () => onSelect(barber) : undefined}
      disabled={!selectable}
      className={cn(
        "group flex w-full items-center gap-4 rounded-3xl p-3 text-left transition-all duration-200",
        selectable
          ? "bg-ink-850 ring-1 ring-white/10 hover:ring-gold-500/60"
          : "cursor-not-allowed bg-ink-900 opacity-55 ring-1 ring-white/5",
      )}
    >
      <Avatar barber={barber} className="size-20" />

      <div className="min-w-0 flex-1">
        <h3 className="font-display truncate text-lg leading-tight font-bold text-white">
          {barber.name}
        </h3>
        {barber.phone ? (
          <p className="mt-0.5 truncate text-sm text-white/50">{barber.phone}</p>
        ) : null}
        <Badge
          tone={
            (barber.status ?? "").trim().toLowerCase() === "available"
              ? "gold"
              : status.tone === "success"
                ? "success"
                : "neutral"
          }
          dot
          className="mt-2"
        >
          {status.label}
        </Badge>
      </div>
    </button>
  );
}

/** Selectable variant used in the booking flow (step 2). */
export function BarberRow({
  barber,
  selected,
  onSelect,
}: {
  barber: Barber;
  selected: boolean;
  onSelect: (barber: Barber) => void;
}) {
  const reduceMotion = useReducedMotion();
  const status = barberStatusMeta(barber.status);
  const unavailable = (barber.status ?? "").trim().toLowerCase() === "off";

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(barber)}
      disabled={unavailable}
      whileTap={reduceMotion || unavailable ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-4 rounded-3xl p-3 text-left transition-all duration-200",
        selected
          ? "bg-gold-500 text-ink-950 shadow-sticker"
          : unavailable
            ? "cursor-not-allowed bg-ink-900 opacity-45 ring-1 ring-white/5"
            : "bg-ink-850 ring-1 ring-white/10 hover:ring-gold-500/45",
      )}
    >
      <Avatar
        barber={barber}
        decorative
        className={cn("size-20", selected && "ring-ink-950/30")}
      />

      <div className="min-w-0 flex-1">
        <h3
          className={cn(
            "font-display truncate text-base font-bold",
            selected ? "text-ink-950" : "text-white",
          )}
        >
          {barber.name}
        </h3>
        {barber.phone ? (
          <p
            className={cn(
              "mt-0.5 truncate text-sm",
              selected ? "text-ink-950/70" : "text-white/50",
            )}
          >
            {barber.phone}
          </p>
        ) : null}
        <span
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-bold tracking-wide uppercase",
            selected
              ? "bg-ink-950 text-gold-400"
              : (barber.status ?? "").trim().toLowerCase() === "available"
                ? "bg-gold-500 text-ink-950"
                : "bg-ink-700 text-white/75",
          )}
        >
          {status.label}
        </span>
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
