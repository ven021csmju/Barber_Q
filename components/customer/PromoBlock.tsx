import { ButtonLink } from "@/components/ui/Button";
import { PriceLockup, Sticker } from "@/components/poster/Poster";
import { formatPrice } from "@/lib/utils";
import type { Promotion, Service } from "@/lib/supabase/types";

/**
 * Promotion block.
 *
 * The brief says to prefer database values over hard-coded ones, so the figure
 * is resolved in this order:
 *   1. a live `promotions` row (discount applied to its own value), else
 *   2. the cheapest `services` row, else
 *   3. nothing — the block renders an honest "no data" state.
 *
 * `discount_type` is free-form text in the schema, so only `percent` and
 * `fixed` are interpreted; anything else falls through to the services path
 * rather than guessing a number.
 */
function resolve(
  promotions: Promotion[],
  services: Service[],
): { title: string; price: number; compareAt?: string; note?: string } | null {
  const promo = promotions[0];
  if (promo) {
    const type = (promo.discount_type ?? "").trim().toLowerCase();
    const base = Number(promo.discount_value) || 0;

    if (promo.name?.trim()) {
      if (type === "percent" && base > 0) {
        return {
          title: promo.name,
          price: Math.round((base / 100) * 100),
          note: promo.description ?? undefined,
        };
      }
      if (base > 0) {
        return {
          title: promo.name,
          price: base,
          note: promo.description ?? undefined,
        };
      }
    }
  }

  const cheapest = services
    .filter((s) => s.price > 0)
    .sort((a, b) => a.price - b.price)[0];

  if (cheapest) {
    return { title: cheapest.name, price: cheapest.price, note: cheapest.description ?? undefined };
  }

  return null;
}

export function PromoBlock({
  promotions,
  services,
}: {
  promotions: Promotion[];
  services: Service[];
}) {
  const offer = resolve(promotions, services);

  return (
    <section
      aria-labelledby="promo-heading"
      className="relative overflow-hidden rounded-4xl bg-green-800 p-5"
    >
      {/* Yellow corner stroke + halftone texture for the printed feel. */}
      <div
        aria-hidden
        className="brush-yellow absolute -top-3 -right-6 h-16 w-40 rotate-6"
      />
      <div
        aria-hidden
        className="halftone absolute inset-0 text-black/12"
      />

      <div className="relative">
        <h2
          id="promo-heading"
          className="font-display text-sm font-bold tracking-[0.22em] text-gold-400 uppercase"
        >
          โปรโมชั่น
        </h2>

        {offer ? (
          <>
            <p className="font-display mt-3 text-2xl leading-tight font-bold text-white">
              {offer.title}
            </p>

            <div className="mt-3">
              <PriceLockup
                value={String(Math.round(offer.price))}
                suffix="บาท"
              />
            </div>

            {offer.note ? (
              <p className="mt-2 max-w-[22rem] text-sm leading-relaxed text-white/65">
                {offer.note}
              </p>
            ) : null}

            <p className="mt-3 text-sm font-bold text-gold-400">
              จองคิวออนไลน์ได้เลย
            </p>

            <ButtonLink href="/booking" size="lg" className="mt-4">
              จองคิว
            </ButtonLink>
          </>
        ) : (
          <div className="mt-3">
            <p className="font-display text-xl leading-tight font-bold text-white/80">
              ยังไม่มีโปรโมชั่น
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              ตอนนี้ยังไม่มีบริการหรือโปรโมชั่นในระบบ
              ลองดูบริการทั้งหมด หรือโทรสอบถามที่ร้าน
            </p>
            <ButtonLink href="/services" variant="outline" className="mt-4">
              ดูบริการทั้งหมด
            </ButtonLink>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Compact variant used on the home page under the hero. Reuses the same
 * resolver so the two never disagree.
 */
export function PromoStrip({
  promotions,
  services,
}: {
  promotions: Promotion[];
  services: Service[];
}) {
  const offer = resolve(promotions, services);
  if (!offer) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-green-800 px-4 py-3.5">
      <div aria-hidden className="halftone absolute inset-0 text-black/12" />
      <div className="relative flex items-center gap-3">
        <Sticker tone="yellow" rotate={-2}>
          โปรโมชั่น
        </Sticker>
        <p className="min-w-0 flex-1 truncate font-display text-base font-bold text-white">
          {offer.title}
        </p>
        <p className="shrink-0 font-display text-xl font-bold text-gold-500 tabular-nums">
          {formatPrice(offer.price)}
        </p>
      </div>
    </div>
  );
}
