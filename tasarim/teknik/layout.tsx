import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Providers from "./providers";

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
      style={{
        // Build-time network fetch'lerini kaldirmak icin local/system stack kullan.
        ["--font-manrope" as string]:
          '"Inter", "Manrope", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        ["--font-space-grotesk" as string]:
          '"Sora", "Space Grotesk", "Inter", "Segoe UI", sans-serif',
        ["--font-plex-mono" as string]:
          '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
      }}
    >
      <body className="sb-body">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
