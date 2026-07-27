import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/brand";

export const runtime = "edge";
export const alt = "What's the Rent — guess the NYC rent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const WINDOWS = [
  { x: 44, y: 78 }, { x: 89, y: 78 }, { x: 134, y: 78 },
  { x: 44, y: 123 }, { x: 89, y: 123 }, { x: 134, y: 123 },
  { x: 44, y: 168 }, { x: 89, y: 168 }, { x: 134, y: 168 },
];

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 64,
          background: "#000000",
          padding: "0 90px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Building motif */}
        <svg width="360" height="400" viewBox="0 0 200 220">
          <path
            d="M30 210 V58 L100 20 L170 58 V210 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <line x1="14" y1="210" x2="186" y2="210" stroke="#ffffff" strokeWidth="4" />
          {WINDOWS.map((w, i) => (
            <rect
              key={i}
              x={w.x}
              y={w.y}
              width="22"
              height="30"
              fill={i % 2 === 0 ? "rgba(92,138,114,0.6)" : "none"}
              stroke="#ffffff"
              strokeWidth="2.5"
            />
          ))}
          <rect x="88" y="182" width="24" height="28" fill="none" stroke="#ffffff" strokeWidth="3" />
        </svg>

        {/* Text block */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#9ca3af",
              fontWeight: 600,
            }}
          >
            Daily NYC Rent Game
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: -3,
              color: "#ffffff",
              lineHeight: 1.02,
              marginTop: 14,
            }}
          >
            {SITE_NAME}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#e5e7eb", marginTop: 22 }}>
            Study the listing. Guess the rent.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#5c8a72", fontWeight: 700, marginTop: 40 }}>
            game.resios.co
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
