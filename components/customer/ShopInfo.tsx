import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Shop contact block.
 *
 * Nothing here is hard-coded: the brief forbids inventing real contact details,
 * and the project has no business-info table. Every field renders only if a
 * value is actually supplied. With no values the block shows an honest
 * "not published yet" state rather than a fake phone number or map link.
 */
export interface ShopContact {
  phone?: string;
  instagram?: string;
  address?: string;
  mapsUrl?: string;
}

function ContactButton({
  href,
  label,
  sub,
  icon,
  primary,
}: {
  href: string;
  label: string;
  sub?: string;
  icon: ReactNode;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-3xl p-3.5 transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px]",
        primary
          ? "bg-gold-500 text-ink-950 shadow-sticker"
          : "bg-ink-850 text-white ring-1 ring-white/10 hover:ring-gold-500/50",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          primary ? "bg-ink-950 text-gold-400" : "bg-green-800 text-gold-400",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display block text-base leading-tight font-bold">
          {label}
        </span>
        {sub ? (
          <span
            className={cn(
              "block truncate text-sm",
              primary ? "text-ink-950/70" : "text-white/50",
            )}
          >
            {sub}
          </span>
        ) : null}
      </span>
    </a>
  );
}

export function ShopInfo({ contact }: { contact: ShopContact }) {
  const { phone, instagram, address, mapsUrl } = contact;
  const published = Boolean(phone || instagram || address);

  return (
    <section aria-labelledby="contact-heading">
      <h2
        id="contact-heading"
        className="font-display text-2xl leading-tight font-bold text-white"
      >
        ติดต่อร้าน
      </h2>

      {!published ? (
        <div className="mt-3 rounded-3xl border-2 border-dashed border-white/15 bg-ink-900 p-5">
          <p className="font-display text-base font-bold text-white/70">
            ข้อมูลติดต่อยังไม่ได้เผยแพร่
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/45">
            ร้านยังไม่ได้กำหนดเบอร์โทร เพจอินสตาแกรม หรือที่ตั้งร้าน
            เมื่อมีข้อมูลแล้วจะแสดงที่นี่ทันที
          </p>
          <ButtonLink href="/booking" className="mt-4">
            จองคิวแทน
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {phone ? (
            <ContactButton
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              label="โทรหาร้าน"
              sub={phone}
              primary
              icon={
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.4 3.8h3l1.5 4-2 1.4a12.4 12.4 0 0 0 5.9 5.9l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.4 6a2 2 0 0 1 2-2.2Z"
                  />
                </svg>
              }
            />
          ) : null}

          {instagram ? (
            <ContactButton
              href={`https://instagram.com/${instagram.replace(/^@/, "")}`}
              label="Instagram"
              sub={`@${instagram.replace(/^@/, "")}`}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                >
                  <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.6" />
                  <circle cx="12" cy="12" r="3.8" />
                  <path strokeLinecap="round" d="M17 7.2h.01" />
                </svg>
              }
            />
          ) : null}

          {address ? (
            <ContactButton
              href={mapsUrl ?? "#"}
              label="สถานที่ตั้ง"
              sub={address}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"
                  />
                  <circle cx="12" cy="10" r="2.6" />
                </svg>
              }
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
