import { BookingWidget } from "@/components/booking/BookingWidget";
import { ImageRail } from "@/components/customer/ImageRail";
import { getPublicAvailability } from "@/lib/supabase/public-slots";
import { shopToday } from "@/lib/utils";

export const dynamic = "force-dynamic";

const GALLERY = [
  { src: "/barber/S__4653084.jpg", alt: "Classic men's haircut detail" },
  { src: "/barber/S__4653082.jpg", alt: "Flook barber shaping a haircut" },
  { src: "/barber/S__4653081.jpg", alt: "Textured haircut from the side" },
  { src: "/barber/S__4653079.jpg", alt: "Barber tools and haircut session" },
  { src: "/barber/cut-w720-1.jpg", alt: "Warm blonde textured haircut" },
  { src: "/barber/cut-w720-2.jpg", alt: "Classic layered men's haircut" },
  { src: "/barber/cut-w720-3.jpg", alt: "Short textured haircut profile" },
  { src: "/barber/cut-w720-4.jpg", alt: "Clean crop haircut detail" },
  { src: "/barber/cut-w720-5.jpg", alt: "Curly textured haircut from the back" },
];

export default async function HomePage() {
  const today = shopToday();
  const { slots, totalAvailable, error } = await getPublicAvailability(today);

  return (
    <div className="space-y-20 pb-8 sm:space-y-28">
      <nav className="flex items-center justify-between border-b border-white/15 py-5" aria-label="Main navigation">
        <a href="#top" className="font-display text-sm font-bold tracking-[0.24em] text-white">
          FLOOK <span className="text-white/35">/ BARBER</span>
        </a>
        <div className="hidden items-center gap-7 text-[0.65rem] font-bold tracking-[0.2em] text-white/50 uppercase sm:flex">
          <a href="#services" className="transition-colors hover:text-white">Services</a>
          <a href="#booking" className="transition-colors hover:text-white">Book</a>
          <a href="#gallery" className="transition-colors hover:text-white">Gallery</a>
        </div>
        <a
          href="#booking"
          className="rounded-full border border-white/30 px-3.5 py-2 text-[0.65rem] font-bold tracking-[0.16em] text-white uppercase transition-colors hover:bg-white hover:text-ink-950"
        >
          Book now
        </a>
      </nav>

      <header id="top" className="-mt-10 space-y-8 sm:-mt-12">
        <div className="max-w-3xl">
          <p className="text-[0.65rem] font-bold tracking-[0.32em] text-white/45 uppercase">FLOOK BARBER</p>
          <h1 id="hero-title" className="mt-5 max-w-xl font-serif text-[4.5rem] leading-[0.78] tracking-[-0.08em] text-white sm:text-[7rem] lg:text-[8.5rem]">
            FLOOK
            <span className="block pl-8 text-white/45">BARBER</span>
          </h1>
          <p className="mt-7 font-display text-sm font-bold tracking-[0.2em] text-white uppercase">YOUR STYLE. YOUR SIGNATURE.</p>
          <p className="mt-8 max-w-sm text-sm leading-7 text-white/55">
            ตัดผมที่สะท้อนตัวคุณ<br />เรียบ เท่ และเป็นสไตล์ของคุณเอง
          </p>
        </div>

        <div className="min-w-0">
          <ImageRail
            labelledBy="hero-title"
            images={[
              { src: "/barber/S__4653082.jpg", alt: "Flook barber giving a haircut" },
              { src: "/barber/S__4653079.jpg", alt: "Flook barber shaping a textured cut" },
              { src: "/barber/S__4653084.jpg", alt: "Finished classic men's haircut" },
            ]}
            cardClassName="w-[70vw] sm:w-[44vw] lg:w-[32vw]"
            aspectClassName="aspect-[4/5]"
            frameless
          />
          <p className="mt-4 text-[0.6rem] font-bold tracking-[0.25em] text-white/50 uppercase">Precision / Style / Confidence</p>
        </div>

        <a
          href="#booking"
          className="inline-flex min-h-12 items-center rounded-full bg-white px-6 text-xs font-bold tracking-[0.18em] text-ink-950 uppercase transition-transform hover:-translate-y-1"
        >
            BOOK APPOINTMENT <span className="ml-5 text-base">↗</span>
        </a>
      </header>

      <section id="booking" className="scroll-mt-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/15 pb-5">
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.28em] text-white/40 uppercase">BOOK YOUR APPOINTMENT</p>
            <h2 className="mt-2 font-serif text-4xl tracking-[-0.04em] text-white sm:text-5xl">YOUR TIME. YOUR CHAIR.</h2>
          </div>
          <p className="max-w-xs text-right text-xs leading-5 text-white/45">เลือกวันที่และเวลาที่ต้องการ<br />แล้วพบกันที่ FLOOK BARBER</p>
        </div>
        <BookingWidget
          initialDate={today}
          initialSlots={slots}
          initialTotalAvailable={totalAvailable}
          initialError={error}
        />
      </section>

      <section id="barber" className="grid scroll-mt-6 gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
        <ImageRail
          labelledBy="barber-title"
          images={[
            { src: "/barber/S__4653079.jpg", alt: "The Flook barber at work" },
            { src: "/barber/S__4653080.jpg", alt: "Textured haircut profile" },
            { src: "/barber/S__4653081.jpg", alt: "Clean side profile haircut" },
          ]}
          cardClassName="w-[78vw] sm:w-[42vw] lg:w-[24vw]"
          aspectClassName="aspect-[4/5]"
        />
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.28em] text-white/40 uppercase">THE BARBER SHOP</p>
          <h2 id="barber-title" className="mt-4 font-display text-4xl font-bold leading-[0.95] tracking-[0.04em] text-white sm:text-6xl">CUT. STYLE. CONFIDENCE.</h2>
          <p className="mt-7 max-w-lg text-sm leading-7 text-white/55">เราเชื่อว่าทรงผมที่ดี ไม่ใช่แค่การตัดให้สั้น<br />แต่คือการออกแบบสไตล์ที่เข้ากับคุณ<br /><br />ใส่ใจในรายละเอียดทุกขั้นตอน<br />ตั้งแต่ทรงผมจนถึงการจัดแต่ง</p>
          <div className="mt-8 grid max-w-md grid-cols-2 border-y border-white/15 py-4 text-[0.65rem] font-bold tracking-[0.18em] text-white/45 uppercase">
            <span>Open daily</span><span className="text-right text-white">09:00 — 21:00</span>
          </div>
        </div>
      </section>

      <section id="gallery" className="scroll-mt-6">
        <div className="flex items-end justify-between border-b border-white/15 pb-5">
          <div><p className="text-[0.65rem] font-bold tracking-[0.28em] text-white/40 uppercase">04 / Work</p><h2 id="gallery-title" className="mt-2 font-serif text-4xl tracking-[-0.04em] text-white sm:text-5xl">In the chair.</h2></div>
          <span className="hidden text-[0.65rem] font-bold tracking-[0.2em] text-white/35 uppercase sm:block">Selected cuts</span>
        </div>
        <div className="mt-8">
          <ImageRail
            labelledBy="gallery-title"
            images={GALLERY}
            cardClassName="w-[82vw] sm:w-[48vw] lg:w-[38vw]"
            aspectClassName="aspect-[4/5]"
          />
        </div>
      </section>

      <footer className="grid gap-8 border-t border-white/15 pt-8 sm:grid-cols-2 lg:grid-cols-3">
        <div><p className="text-[0.65rem] font-bold tracking-[0.25em] text-white/40 uppercase">FLOOK BARBER</p><p className="mt-3 font-serif text-3xl text-white">MAKE YOUR STYLE COUNT.</p></div>
        <div className="text-sm leading-7 text-white/55"><p>09:00 — 21:00</p><p>Lunch break · 12:00 — 13:00</p><a href="tel:0805211831" className="text-white underline underline-offset-4">080 521 1831</a></div>
        <div className="flex flex-wrap gap-5 text-[0.65rem] font-bold tracking-[0.18em] text-white/60 uppercase sm:justify-end"><a href="https://www.instagram.com/flook_barber/" target="_blank" rel="noreferrer" className="hover:text-white">Instagram</a><a href="https://maps.app.goo.gl/5Gfn126DCQEFGiSb8?g_st=ic" target="_blank" rel="noreferrer" className="hover:text-white">Google Maps</a><span className="w-full text-white/30 sm:text-right">© 2026 FLOOK BARBER</span></div>
      </footer>
    </div>
  );
}
