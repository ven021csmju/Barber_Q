"use client";

import { motion, useReducedMotion } from "motion/react";
import { ButtonLink } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/SmartImage";
import { BrushSwipe, ScissorsMark, Sticker } from "@/components/poster/Poster";
import { cn } from "@/lib/utils";
import { IMAGES } from "@/lib/images";

/**
 * Poster hero.
 *
 * Composition: an oversized off-white wordmark stack, a yellow brush swipe
 * behind the Thai headline, a green ink field, and one large barber photograph
 * bleeding off the right edge. Original layout — the reference poster informed
 * the palette and type, not the arrangement.
 */
export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative -mx-5 overflow-hidden">
      {/* Flat green ink field. */}
      <div aria-hidden className="absolute inset-0 bg-green-800" />
      <div
        aria-hidden
        className="halftone absolute inset-0 opacity-[0.09]"
      />
      <ScissorsMark className="absolute -top-2 right-4 size-24 rotate-12 text-gold-500/12" />

      <div className="relative px-5 pt-8 pb-7">
        {/* Wordmark row */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-sm leading-none font-bold tracking-[0.34em] text-white uppercase">
            FLOOK
          </span>
          <Sticker tone="yellow" rotate={2}>
            ร้านตัดผมชาย
          </Sticker>
        </div>

        <div className="mt-6 grid gap-6">
          {/* Headline stack */}
          <div>
            <motion.h1
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-[2.75rem] leading-[0.95] font-bold tracking-tight text-white sm:text-6xl"
            >
              หล่อได้
              <br />
              <BrushSwipe tone="yellow">ทุกวัน</BrushSwipe>
            </motion.h1>

            <motion.p
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 max-w-[19rem] text-lg leading-snug font-bold text-white/90"
            >
              ตัดดี ราคาเป็นมิตร
              <span className="mt-1 block text-sm font-normal text-white/60">
                เลือกบริการ เลือกช่าง แล้วจองเวลาที่สะดวกได้ทันที
              </span>
            </motion.p>
          </div>

          {/* Photography */}
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="relative h-56 w-full overflow-hidden rounded-4xl ring-4 ring-gold-500 sm:h-72">
              <SmartImage
                src={IMAGES.hero}
                alt="บรรยากาศภายในร้าน FLOOK BARBER"
                priority
                sizes="(max-width: 480px) 90vw, 440px"
                className="h-full w-full"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-linear-to-t from-ink-950/60 to-transparent"
              />
            </div>

            {/* Sticker overlapping the photo corner. */}
            <span className="absolute -bottom-3 left-5">
              <Sticker tone="ink" rotate={-3}>
                จองคิวออนไลน์
              </Sticker>
            </span>
          </motion.div>
        </div>

        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 flex flex-col gap-3"
        >
          <ButtonLink href="/booking" size="lg" fullWidth>
            จองคิว
          </ButtonLink>
          <ButtonLink href="/services" variant="outline" size="lg" fullWidth>
            ดูบริการ
          </ButtonLink>
        </motion.div>
      </div>
    </section>
  );
}

/** Slim poster stat strip under the hero. */
export function HeroStats({ items }: { items: { value: string; label: string }[] }) {
  return (
    <dl className="-mt-1 grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-3xl bg-ink-900 ring-1 ring-white/10">
      {items.map((item) => (
        <div key={item.label} className="px-2 py-4 text-center">
          <dt className="sr-only">{item.label}</dt>
          <dd>
            <span className="font-display block text-lg leading-none font-bold text-gold-500">
              {item.value}
            </span>
            <span className="mt-1 block text-xs font-medium text-white/50">
              {item.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Section heading with an optional trailing link. */
export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-2xl leading-tight font-bold tracking-tight text-white">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-white/50">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
