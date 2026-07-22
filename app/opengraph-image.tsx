import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Rent Hunch — Guess the Brooklyn rent";
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
          background: "#14181f",
          color: "#eee6d8",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -2,
          }}
        >
          Rent Hunch
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 34,
            color: "#b4432e",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Guess today&apos;s Brooklyn rent
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 22,
            color: "#5c8a72",
          }}
        >
          A new listing, every day
        </div>
      </div>
    ),
    { ...size }
  );
}
