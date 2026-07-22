import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/brand";

export const runtime = "edge";
export const alt = "What's the Rent — Guess the Brooklyn rent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#000000",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "#9ca3af",
            letterSpacing: 6,
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          Daily Rent Game · Brooklyn
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 108,
            fontWeight: 800,
            letterSpacing: -3,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 30,
            color: "#e5e7eb",
          }}
        >
          Study the listing. Lock your guess.
        </div>
      </div>
    ),
    { ...size }
  );
}
