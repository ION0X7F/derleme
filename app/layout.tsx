import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  IBM_Plex_Mono,
  Inter,
  Sora,
} from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
});

const sora = Sora({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const themeInitScript = `
  (() => {
    try {
      const stored = localStorage.getItem("sellboost-theme");
      const theme = stored === "light" || stored === "dark" ? stored : "light";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
    } catch {
      document.documentElement.dataset.theme = "light";
      document.documentElement.style.colorScheme = "light";
    }
  })();
`;

export const metadata: Metadata = {
  metadataBase: new URL("https://sellboost.app"),
  title: {
    default: "SellBoost AI",
    template: "%s | SellBoost AI",
  },
  description:
    "Trendyol urun linklerini analiz eden, neden satmadigini veri odakli yorumlayan premium AI karar paneli.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      data-theme="light"
      className={`${inter.variable} ${sora.variable} ${plexMono.variable}`}
    >
      <body className="sb-body">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
