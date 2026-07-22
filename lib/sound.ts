// Tiny synthesized sound engine — no audio files, works offline, no CSP
// issues. All tones are generated with the Web Audio API on demand. The
// AudioContext is created lazily on the first sound (always triggered by a
// user gesture, so autoplay policies are satisfied).

let ctx: AudioContext | null = null;
let muted = false;

if (typeof window !== "undefined") {
  muted = window.localStorage.getItem("wtr-muted") === "1";
}

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * iOS/Safari start the AudioContext suspended and only allow it to resume
 * inside a user gesture. Call this once on mount: it resumes (creating if
 * needed) the context on the first pointer/touch/key interaction so later
 * programmatic sounds (e.g. the reveal chime) can play.
 */
export function primeAudio(): void {
  if (typeof window === "undefined") return;
  const unlock = () => {
    audioCtx();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchend", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("touchend", unlock);
  window.addEventListener("keydown", unlock);
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("wtr-muted", next ? "1" : "0");
  }
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone(freq: number, dur: number, { type = "sine", gain = 0.06, delay = 0 }: ToneOpts = {}) {
  const c = audioCtx();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  /** Quick tick for +/-10% adjustments. */
  tick: () => tone(420, 0.05, { type: "triangle", gain: 0.035 }),
  /** Soft two-note pop when a clue is revealed. */
  reveal: () => {
    tone(540, 0.12, { type: "sine", gain: 0.05 });
    tone(810, 0.12, { type: "sine", gain: 0.03, delay: 0.05 });
  },
  /** Weighty "thunk" when the guess is locked. */
  lock: () => {
    tone(210, 0.18, { type: "sawtooth", gain: 0.05 });
    tone(120, 0.24, { type: "sine", gain: 0.06, delay: 0.02 });
  },
  /** Rising arpeggio on reveal — longer/brighter the better the score. */
  win: (score: number) => {
    const notes =
      score >= 800 ? [523, 659, 784, 1047] : score >= 500 ? [523, 659, 784] : [440, 554];
    notes.forEach((f, i) => tone(f, 0.28, { type: "triangle", gain: 0.06, delay: i * 0.09 }));
  },
  /** Gentle falling two-note for a low score. */
  low: () => {
    tone(330, 0.22, { type: "sine", gain: 0.05 });
    tone(247, 0.3, { type: "sine", gain: 0.05, delay: 0.1 });
  },
  /** Confirmation blip used to test that audio is working. */
  blip: () => tone(660, 0.14, { type: "sine", gain: 0.06 }),
};
