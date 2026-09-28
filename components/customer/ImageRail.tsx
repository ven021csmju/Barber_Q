"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type RailImage = {
  src: string;
  alt: string;
};

/** Native snap rail: swipe on touch, arrow controls on larger screens. */
export function ImageRail({
  images,
  cardClassName = "w-[82vw] sm:w-[48vw] lg:w-[38vw]",
  aspectClassName = "aspect-[4/5]",
  labelledBy,
  frameless = false,
}: {
  images: RailImage[];
  cardClassName?: string;
  aspectClassName?: string;
  labelledBy?: string;
  frameless?: boolean;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || paused || images.length < 2) return;

    const timer = window.setInterval(() => {
      const target = rail.current;
      if (!target) return;

      const atEnd = target.scrollLeft + target.clientWidth >= target.scrollWidth - 8;
      target.scrollTo({
        left: atEnd ? 0 : target.scrollLeft + target.clientWidth * 0.72,
        behavior: "smooth",
      });
    }, 4500);

    return () => window.clearInterval(timer);
  }, [images.length, paused, reduceMotion]);

  function scroll(direction: -1 | 1) {
    setPaused(true);
    rail.current?.scrollBy({
      left: direction * (rail.current.clientWidth * 0.72),
      behavior: "smooth",
    });
  }

  return (
    <div className="relative min-w-0">
      <div
        ref={rail}
        aria-labelledby={labelledBy}
        onPointerDown={() => setPaused(true)}
        onFocus={() => setPaused(true)}
        onMouseEnter={() => setPaused(true)}
        onScroll={(event) => {
          const target = event.currentTarget;
          const step = target.clientWidth * 0.72;
          setActive(Math.min(images.length - 1, Math.round(target.scrollLeft / step)));
        }}
        className={cn(
          "no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth overscroll-x-contain py-1 touch-pan-x sm:gap-5",
          frameless ? "px-0" : "px-[8vw] sm:px-[5vw] lg:px-0",
        )}
      >
        {images.map((image) => (
          <figure
            key={image.src}
            className={cn(
              "relative shrink-0 snap-center",
              !frameless && "overflow-hidden rounded-[1.75rem] bg-ink-800",
              cardClassName,
              aspectClassName,
            )}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 640px) 82vw, (max-width: 1024px) 48vw, 38vw"
              className="object-cover transition-transform duration-700 ease-out hover:scale-[1.04]"
            />
          </figure>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex gap-1.5" aria-label={`Image ${active + 1} of ${images.length}`}>
          {images.map((image, index) => (
            <span
              key={image.src}
              className={cn(
                "h-1 rounded-full transition-all",
                index === active ? "w-8 bg-white" : "w-2 bg-white/25",
              )}
            />
          ))}
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Previous image"
            className="grid size-10 place-items-center rounded-full border border-white/20 text-lg text-white transition-colors hover:bg-white hover:text-ink-950"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Next image"
            className="grid size-10 place-items-center rounded-full border border-white/20 text-lg text-white transition-colors hover:bg-white hover:text-ink-950"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
