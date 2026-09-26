"use client";

import { motion, useReducedMotion } from "motion/react";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn, formatPrice } from "@/lib/utils";
import type { Barber, Service } from "@/lib/supabase/types";

/** One label/value row. */
function Row({
  label,
  value,
  hint,
  onEdit,
  editLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/8 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-white/40">{label}</p>
        <p className="font-display mt-0.5 truncate text-[0.95rem] font-bold text-white">
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-xs text-white/35">{hint}</p> : null}
      </div>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel ?? `แก้ไข${label}`}
          className="shrink-0 self-center rounded-full bg-ink-800 px-3 py-1.5 text-xs font-bold text-gold-400 transition-colors hover:bg-gold-500 hover:text-ink-950"
        >
          แก้ไข
        </button>
      ) : null}
    </div>
  );
}

/**
 * Live recap of the current selection, rendered on the confirmation step and as
 * a sticky sheet on the intermediate steps.
 */
export function BookingSummary({
  service,
  barber,
  date,
  time,
  onEditStep,
  compact = false,
}: {
  service: Service | null;
  barber: Barber | null;
  date: string | null;
  time: string | null;
  onEditStep?: (stepIndex: number) => void;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-4xl bg-ink-900 ring-1 ring-white/10",
        compact ? "p-4" : "p-5",
      )}
    >
      {/* Yellow brush wipe across the top edge. */}
      <div
        aria-hidden
        className="brush-yellow absolute inset-x-0 -top-1 h-3 opacity-90"
      />

      <div className="mt-1 flex items-center gap-3 pb-1">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl ring-2 ring-gold-500/40">
          <SmartImage
            src={service?.image_url}
            alt={service?.name ?? "บริการ"}
            sizes="56px"
            className="h-full w-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-base font-bold text-white">
            {service?.name ?? "ยังไม่ได้เลือกบริการ"}
          </p>
          <p className="truncate text-sm text-white/50">
            {barber ? `กับช่าง ${barber.name}` : "ยังไม่ได้เลือกช่าง"}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Row
          label="บริการ"
          value={service?.name ?? "—"}
          onEdit={onEditStep ? () => onEditStep(0) : undefined}
        />
        <Row
          label="ช่าง"
          value={barber?.name ?? "—"}
          onEdit={onEditStep ? () => onEditStep(1) : undefined}
        />
        <Row
          label="วันที่"
          value={date ?? "—"}
          onEdit={onEditStep ? () => onEditStep(2) : undefined}
        />
        <Row
          label="เวลา"
          value={time ?? "—"}
          onEdit={onEditStep ? () => onEditStep(3) : undefined}
        />
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t-2 border-dashed border-white/12 pt-4">
        <span className="font-display text-sm font-bold text-white/60">ราคารวม</span>
        <span className="font-display text-3xl font-bold text-gold-500">
          {service ? formatPrice(service.price) : "—"}
        </span>
      </div>
    </motion.div>
  );
}
