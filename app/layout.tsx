import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const siteUrl = "https://game.resios.co";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Rent Hunch — Guess the Brooklyn rent",
  description:
    "A daily rent-price-guessing game. Study the listing, lock your guess, see how close you got. New Brooklyn rental every day.",
  openGraph: {
    title: "Rent Hunch — Guess the Brooklyn rent",
    description:
      "A daily rent-price-guessing game. Study the listing, lock your guess, see how close you got.",
    url: siteUrl,
    siteName: "Rent Hunch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rent Hunch — Guess the Brooklyn rent",
    description:
      "A daily rent-price-guessing game. Study the listing, lock your guess, see how close you got.",
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
      className={`${fraunces.variable} ${plexMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink-navy text-paper">
        {children}
      </body>
    </html>
  );
}
