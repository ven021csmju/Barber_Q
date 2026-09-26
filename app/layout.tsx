import type { Metadata, Viewport } from "next";
import { Bai_Jamjuree, IBM_Plex_Sans_Thai, Sora } from "next/font/google";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/** Poster display face. Covers Thai + Latin so headlines need no fallback. */
const bai = Bai_Jamjuree({
  variable: "--font-bai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Latin-only, kept for tabular numerals and small caps labels. */
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FLOOK BARBER — จองคิวตัดผม",
    template: "%s · FLOOK BARBER",
  },
  description:
    "FLOOK BARBER — ระบบจองคิวตัดผมออนไลน์ เลือกบริการ เลือกช่าง เลือกวันและเวลาที่สะดวก",
  applicationName: "FLOOK BARBER",
  appleWebApp: {
    capable: true,
    title: "FLOOK BARBER",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "FLOOK BARBER — จองคิวตัดผม",
    description: "จองคิวตัดผมง่าย ๆ กับช่างมืออาชีพ",
    locale: "th_TH",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${plexThai.variable} ${bai.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-ink-950 text-paper">{children}</body>
    </html>
  );
}
