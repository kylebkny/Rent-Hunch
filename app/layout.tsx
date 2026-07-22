import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/brand";
import "./globals.css";

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#000000",
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const title = `${SITE_NAME} — Guess the Brooklyn rent`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description: `A daily rent-price-guessing game. ${SITE_TAGLINE} New Brooklyn rental every day.`,
  openGraph: {
    title,
    description: `A daily rent-price-guessing game. ${SITE_TAGLINE}`,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: `A daily rent-price-guessing game. ${SITE_TAGLINE}`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-paper">
        {children}
      </body>
    </html>
  );
}
