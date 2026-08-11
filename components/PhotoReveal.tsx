"use client";

import { useState } from "react";
import { unlockedPhotoCount } from "@/lib/photo-reveal";

interface PhotoRevealProps {
  photos: string[];
  round: number;
}

// Single-image fallback: the one photo sharpens as rounds advance.
const BLUR_BY_ROUND = ["blur(14px)", "blur(8px)", "blur(3px)", "blur(0px)"];

export function PhotoReveal({ photos, round }: PhotoRevealProps) {
  const unlocked = unlockedPhotoCount(round, photos.length);
  const [selected, setSelected] = useState(unlocked - 1);
  const [prevUnlocked, setPrevUnlocked] = useState(unlocked);

  // When a new photo unlocks, jump the main view to it (adjust-state-during-
  // render pattern — no effect needed).
  if (prevUnlocked !== unlocked) {
    setPrevUnlocked(unlocked);
    setSelected(unlocked - 1);
  }

  const isSingle = photos.length === 1;
  const mainIndex = Math.min(selected, unlocked - 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-mist">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[mainIndex]}
          alt={`Listing photo ${mainIndex + 1}`}
          className="h-full w-full object-cover transition-[filter] duration-500"
          style={isSingle ? { filter: BLUR_BY_ROUND[Math.min(round, 3)] } : undefined}
        />
        {photos.length > 1 && (
          <div className="absolute bottom-2 right-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-medium text-paper tabular-nums">
            {unlocked} / {photos.length}
          </div>
        )}
        {isSingle && round < 3 && (
          <div className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-medium text-paper">
            Sharpens each clue
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => {
            const locked = i >= unlocked;
            return (
              <button
                key={i}
                type="button"
                disabled={locked}
                onClick={() => setSelected(i)}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  i === mainIndex ? "border-ink" : "border-transparent"
                } ${locked ? "cursor-not-allowed" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt={`Thumbnail ${i + 1}`}
                  className={`h-full w-full object-cover ${locked ? "blur-[6px] brightness-75" : ""}`}
                />
                {locked && (
                  <span className="absolute inset-0 flex items-center justify-center text-paper text-lg">
                    ＋
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
