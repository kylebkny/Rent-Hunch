"use client";

import { useEffect, useState } from "react";

export function HowToPlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("wtr-seen-help")) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- first-visit open
        setOpen(true);
        localStorage.setItem("wtr-seen-help", "1");
      }
    } catch {
      // localStorage unavailable — help just won't auto-open.
    }
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="How to play"
        className="fixed top-4 left-4 z-40 h-10 w-10 rounded-full bg-paper/10 hover:bg-paper/20 text-paper font-semibold flex items-center justify-center transition"
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-paper text-ink p-6 flex flex-col gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-tight">How to play</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted text-xl leading-none">✕</button>
            </div>
            <ol className="flex flex-col gap-3 text-sm text-ink">
              <Rule n="1">Study today&apos;s Brooklyn listing — a new clue unlocks with each guess.</Rule>
              <Rule n="2">Make up to <b>4 guesses</b> at the monthly rent. After each, you&apos;ll see if you&apos;re <b>too high or low</b> and how <b>warm</b> you are (🟩 hot · 🟨 warm · 🟥 cold).</Rule>
              <Rule n="3">Your score is set by your <b>closest</b> guess. Nailing it early earns a small bonus, but getting close is what matters.</Rule>
              <Rule n="4">Come back every day to build your 🔥 <b>streak</b> and climb the leaderboard.</Rule>
            </ol>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full bg-ink text-paper font-semibold py-3 hover:bg-ink-soft transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Rule({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 h-6 w-6 rounded-full bg-ink text-paper text-xs font-semibold flex items-center justify-center">{n}</span>
      <span>{children}</span>
    </li>
  );
}
