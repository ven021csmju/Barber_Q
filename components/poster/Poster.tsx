import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Poster primitives.
 *
 * The handmade look comes from three cheap, reliable techniques: irregular
 * `clip-path` brush strokes, hard offset shadows (no blur), and slight
 * rotations. All are decoration-only — none of them carry data or state, and
 * every interactive control keeps a clean rectangular hit area.
 */

/** A brush swipe sitting behind inline text. */
export function BrushSwipe({
  children,
  tone = "yellow",
  className,
}: {
  children: ReactNode;
  tone?: "yellow" | "green" | "white";
  className?: string;
}) {
  const fill = {
    yellow: "brush-yellow text-ink-950",
    green: "brush-green text-white",
    white: "brush-white text-ink-950",
  }[tone];

  return (
    <span className={cn("relative inline-block", className)}>
      {/* aria-hidden: the stroke is decoration, the text carries meaning. */}
      <span
        aria-hidden
        className={cn("brush absolute inset-0 -z-10 scale-y-[0.9]", fill)}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

/**
 * Big Thai poster heading. `step` renders the "01 / บริการ" eyebrow used by the
 * booking flow and the section blocks.
 */
export function PosterHeading({
  eyebrow,
  title,
  subtitle,
  step,
  tone = "light",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  step?: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {(eyebrow || step) && (
        <p
          className={cn(
            "font-display flex items-center gap-2 text-xs font-bold tracking-[0.22em] uppercase",
            tone === "dark" ? "text-ink-950/60" : "text-gold-400",
          )}
        >
          {step ? (
            <span
              className={cn(
                "grid size-6 place-items-center rounded-md text-[0.7rem] tracking-normal",
                tone === "dark"
                  ? "bg-ink-950 text-gold-400"
                  : "bg-gold-500 text-ink-950",
              )}
            >
              {step}
            </span>
          ) : null}
          {eyebrow}
        </p>
      )}

      <h2
        className={cn(
          "font-display text-[1.75rem] leading-[1.1] font-bold tracking-tight",
          tone === "dark" ? "text-ink-950" : "text-white",
        )}
      >
        {title}
      </h2>

      {subtitle ? (
        <p
          className={cn(
            "text-sm leading-relaxed",
            tone === "dark" ? "text-ink-950/70" : "text-white/55",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/** Sticker-style label. The slight rotation is what sells "stuck on". */
export function Sticker({
  children,
  tone = "yellow",
  rotate = -2,
  className,
}: {
  children: ReactNode;
  tone?: "yellow" | "green" | "ink";
  rotate?: number;
  className?: string;
}) {
  const tones = {
    yellow: "bg-gold-500 text-ink-950",
    green: "bg-green-600 text-white",
    ink: "bg-ink-950 text-gold-400 ring-1 ring-gold-500/40",
  }[tone];

  return (
    <span
      className={cn(
        "sticker rounded-full px-3 py-1.5 font-display text-[0.7rem] font-bold tracking-[0.14em] uppercase",
        tones,
        className,
      )}
      style={{ rotate: `${rotate}deg` }}
    >
      {children}
    </span>
  );
}

/** Huge price lockup, e.g. the promotion block. */
export function PriceLockup({
  value,
  suffix,
  compareAt,
}: {
  value: string;
  suffix?: string;
  compareAt?: string;
}) {
  return (
    <p className="flex items-end gap-2">
      <span className="font-display text-[4.5rem] leading-[0.8] font-bold text-gold-500 tabular-nums">
        {value}
      </span>
      {suffix ? (
        <span className="font-display pb-1 text-2xl font-bold text-white">
          {suffix}
        </span>
      ) : null}
      {compareAt ? (
        <span className="pb-1.5 text-base font-bold text-white/40 line-through">
          {compareAt}
        </span>
      ) : null}
    </p>
  );
}

/** Torn off-white strip used to separate poster sections. */
export function TornDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative h-3 w-full", className)}>
      <div className="torn-top absolute inset-x-0 bottom-0 h-2 bg-green-800" />
    </div>
  );
}

/** Decorative barber-tool icons. Purely aria-hidden scenery. */
export function ScissorsMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.4 8.6 17.2 19.4M17.6 8.6 6.8 19.4M8.4 5.6a2 2 0 1 1-2.8 2.8 2 2 0 0 1 2.8-2.8Zm10.8 0a2 2 0 1 0-2.8 2.8 2 2 0 0 0 2.8-2.8Z"
      />
    </svg>
  );
}

export function RazorMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 14.6 14.6 4.5l4.9 4.9L9.4 19.5H4.5v-4.9ZM16.4 2.7l1.4-1.4 5 5-1.4 1.4M8.2 15.4l1.4 1.4"
      />
    </svg>
  );
}

export function CombMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.4 8.2h17.2v2.4H3.4zM5.6 10.6v8.8M8.9 10.6v8.8M12.2 10.6v8.8M15.5 10.6v8.8M18.8 10.6v8.8"
      />
    </svg>
  );
}
