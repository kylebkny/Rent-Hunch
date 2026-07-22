"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted, primeAudio, sfx } from "@/lib/sound";

export function MuteToggle() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    primeAudio();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read stored pref after hydration
    setMutedState(isMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    // Play a confirmation blip when turning sound ON (also unlocks iOS audio).
    if (!next) sfx.blip();
  }

  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] right-4 z-40 h-10 w-10 rounded-full bg-paper/10 hover:bg-paper/20 text-paper flex items-center justify-center transition"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
