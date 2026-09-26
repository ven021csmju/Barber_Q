import { BookingWidget } from "@/components/booking/BookingWidget";
import { ScissorsMark } from "@/components/poster/Poster";
import { getPublicAvailability } from "@/lib/supabase/public-slots";
import { shopToday } from "@/lib/utils";

/** Availability is live data; the page must never be cached. */
export const dynamic = "force-dynamic";

/**
 * The homepage IS the booking page.
 *
 * No hero image, no services, no barbers, no promotions above the fold: the
 * shop name and the calendar are the first and only thing on screen, so a guest
 * can start booking in two seconds.
 *
 * Today's slots are read on the server so the grid is populated in the first
 * paint, instead of flashing an empty calendar while the browser fetches.
 */
export default async function HomePage() {
  const today = shopToday();
  const { slots, totalAvailable, error } = await getPublicAvailability(today);

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-3xl bg-green-800 px-4 py-5">
        <div aria-hidden className="halftone absolute inset-0 opacity-[0.08]" />
        <ScissorsMark
          aria-hidden
          className="absolute -right-3 -bottom-3 size-28 rotate-12 text-gold-500/12"
        />

        <div className="relative">
          <p className="font-display text-[0.7rem] font-bold tracking-[0.32em] text-gold-400 uppercase">
            FLOOK
          </p>
          <h1 className="font-display mt-1 text-[2rem] leading-none font-bold text-white">
            FLOOK BARBER
          </h1>
          <p className="font-display mt-2 text-lg font-bold text-gold-500">จองคิวตัดผม</p>
          <p className="mt-1 text-sm text-white/65">เลือกวันที่ เลือกเวลา กรอกชื่อ กดจองเสร็จ</p>
        </div>
      </header>

      <BookingWidget
        initialDate={today}
        initialSlots={slots}
        initialTotalAvailable={totalAvailable}
        initialError={error}
      />

      <section
        aria-labelledby="contact-shop"
        className="rounded-3xl bg-ink-900 p-4 ring-1 ring-white/10"
      >
        <h2 id="contact-shop" className="font-display text-base font-bold text-white">
          ติดต่อร้าน
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a
            href="tel:0805211831"
            className="flex min-h-12 items-center justify-center rounded-2xl bg-green-800 px-4 text-sm font-bold text-white transition-colors hover:bg-green-700"
          >
            โทร 080 521 1831
          </a>
          <a
            href="https://www.facebook.com/Aphidet.Phaithean"
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center justify-center rounded-2xl bg-blue-700 px-4 text-sm font-bold text-white transition-colors hover:bg-blue-600"
          >
            Facebook: Aphidet Phaithean
          </a>
        </div>
      </section>
    </div>
  );
}
