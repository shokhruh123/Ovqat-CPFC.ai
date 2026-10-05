import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";
import { VisualEffects } from "@/components/VisualEffects";

// Дисплейный гротеск с кириллицей (заголовки) + Manrope (текст).
// next/font — селф-хостинг, без <link> на Google Fonts (требование дизайн-скилла).
const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ovqat CPFC.ai — калории по фото",
  description:
    "Ovqat CPFC.ai: сфотографируй блюдо — Gemini определит калории, белки, жиры, углеводы и даст совет. Камера и галерея на Samsung / iPhone.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#d97706",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${display.variable} ${body.variable} ambient min-h-dvh antialiased`}>
        <VisualEffects />
        {children}
      </body>
    </html>
  );
}
