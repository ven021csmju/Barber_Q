"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Tiny 16x10 blur-up placeholder, in the black/green poster palette. */
const BLUR_DATA_URL =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173d25"/><stop offset="1" stop-color="#0b0b0b"/></linearGradient></defs><rect width="16" height="10" fill="url(#g)"/></svg>`,
  );

export interface SmartImageProps {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Shown behind the image while loading. */
  wrapperClassName?: string;
}

/**
 * `next/image` with a graceful, on-brand fallback.
 *
 * Remote photos can 404 or be blocked; instead of a broken image icon the card
 * keeps a printed poster panel with a barber mark. This is what makes the
 * editorial stock imagery safe to ship before Supabase Storage is set up.
 */
export function SmartImage({
  src,
  alt,
  fill = true,
  width,
  height,
  sizes,
  priority = false,
  className,
  wrapperClassName,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div className={cn("relative overflow-hidden bg-green-900", wrapperClassName)}>
      {/* Base panel always painted, so there is never an empty box. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-green-900",
          showFallback && "after:halftone after:absolute after:inset-0 after:opacity-[0.12]",
        )}
      />

      {showFallback ? (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 grid place-items-center"
        >
          {/* Scissors mark */}
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="size-10 text-gold-500/45"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.5 8.5 17 19M17.5 8.5 7 19M8.6 5.4a2.1 2.1 0 1 1-3 3 2.1 2.1 0 0 1 3-3Zm10.8 0a2.1 2.1 0 1 0-3 3 2.1 2.1 0 0 0 3-3Z"
            />
          </svg>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          {...(fill ? { fill: true } : { width: width ?? 800, height: height ?? 600 })}
          sizes={sizes ?? "(max-width: 768px) 90vw, 400px"}
          priority={priority}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          onError={() => setFailed(true)}
          className={cn("object-cover", className)}
        />
      )}
    </div>
  );
}
