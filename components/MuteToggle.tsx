"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted } from "@/lib/sound";

export function MuteToggle() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    // Read the stored preference after hydration to avoid a server/client
    // mismatch (localStorage isn't available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMutedState(isMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      className="fixed top-4 right-4 z-40 h-10 w-10 rounded-full bg-paper/10 hover:bg-paper/20 text-paper flex items-center justify-center transition"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
