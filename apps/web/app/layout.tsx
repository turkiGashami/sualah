import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@/components/Analytics";

export const metadata: Metadata = {
  title: "سُعلاة",
  description: "لعبة جلسات عربية بأدوار خفية بثيم أساطير الجزيرة",
};

export const viewport: Viewport = {
  themeColor: "#08070e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Rakkas&family=Tajawal:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="grain" aria-hidden />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
