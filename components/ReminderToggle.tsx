"use client";

import { useEffect, useState } from "react";
import { pushSupported, isSubscribed, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";

export function ReminderToggle() {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature-detect after hydration
    setSupported(true);
    isSubscribed().then(setOn);
  }, []);

  if (!supported) return null;

  async function toggle() {
    setBusy(true);
    setNote(null);
    try {
      if (on) {
        await unsubscribeFromPush();
        setOn(false);
      } else {
        const ok = await subscribeToPush();
        setOn(ok);
        if (!ok) setNote("Enable notifications to get the daily reminder.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-center">
      <button
        onClick={toggle}
        disabled={busy}
        className="text-sm font-medium text-muted hover:text-ink transition disabled:opacity-50"
      >
        {on ? "🔔 Daily reminder on — tap to turn off" : "🔔 Remind me when the next one drops"}
      </button>
      {note && <p className="text-xs text-faint mt-1">{note}</p>}
    </div>
  );
}
