"use client";

import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Animates a number from 0 up to `target` over `durationMs`. */
export function useCountUp(target: number, durationMs = 900): number {
  // Reduced-motion / SSR start at the final value; otherwise animate from 0.
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || prefersReducedMotion()) return;

    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * easeOutCubic(p)));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
