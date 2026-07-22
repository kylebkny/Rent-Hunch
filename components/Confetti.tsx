"use client";

import { useEffect, useState } from "react";

const COLORS = ["#16a34a", "#0f1420", "#ffffff", "#9ca3af", "#5c8a72"];
const PIECES = 44;

interface Piece {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  drift: number;
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.8 + Math.random() * 1,
    size: 6 + Math.random() * 6,
    color: COLORS[i % COLORS.length],
    drift: (Math.random() - 0.5) * 160,
  }));
}

/** Lightweight, dependency-free confetti burst. Renders nothing when the
 *  user prefers reduced motion, and removes itself after the animation. */
export function Confetti() {
  const [show, setShow] = useState(
    () => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  // Generated once — random values must not be recomputed during render.
  const [pieces] = useState(makePieces);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            // @ts-expect-error custom property
            "--drift": `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
