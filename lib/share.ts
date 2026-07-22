import { MAX_POSSIBLE_SCORE, guessTrailEmoji, bandColor, type WarmthBand } from "@/lib/scoring";
import { SITE_NAME } from "@/lib/brand";

export interface ShareData {
  edition: number;
  score: number;
  bands: WarmthBand[];
  guessesUsed: number;
}

// Non-spoiling: shows the trail + score, never the actual rent, so sharing
// into a group chat doesn't give away the day's answer.
export function buildShareText({ edition, score, bands }: ShareData): string {
  return `${SITE_NAME} #${edition}\n${guessTrailEmoji(bands)}  ${score}/${MAX_POSSIBLE_SCORE}\ngame.resios.co`;
}

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif";

export async function renderResultCard(data: ShareData): Promise<Blob | null> {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Brand-black background with a thin frame.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#1b2230";
  ctx.lineWidth = 2;
  roundRect(ctx, 40, 40, size - 80, size - 80, 40);
  ctx.stroke();

  ctx.textAlign = "center";

  // Wordmark + edition.
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 66px ${SANS}`;
  ctx.fillText(SITE_NAME, size / 2, 210);
  ctx.fillStyle = "#9ca3af";
  ctx.font = `600 40px ${SANS}`;
  ctx.fillText(`#${data.edition}`, size / 2, 275);

  // Trail as drawn rounded squares (crisper than emoji glyphs on canvas).
  const bands = data.bands.length > 0 ? data.bands : (["cold"] as WarmthBand[]);
  const sq = bands.length > 4 ? 120 : 140;
  const gap = 28;
  const totalW = bands.length * sq + (bands.length - 1) * gap;
  let x = (size - totalW) / 2;
  const y = 400;
  for (const band of bands) {
    ctx.fillStyle = bandColor(band);
    roundRect(ctx, x, y, sq, sq, 24);
    ctx.fill();
    x += sq + gap;
  }

  // Score.
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 150px ${SANS}`;
  ctx.fillText(String(data.score), size / 2, 760);
  ctx.fillStyle = "#9ca3af";
  ctx.font = `600 44px ${SANS}`;
  ctx.fillText(`/ ${MAX_POSSIBLE_SCORE} pts`, size / 2, 820);

  const guessWord = data.guessesUsed === 1 ? "guess" : "guesses";
  ctx.fillStyle = "#9ca3af";
  ctx.font = `500 38px ${SANS}`;
  ctx.fillText(`in ${data.guessesUsed} ${guessWord}`, size / 2, 890);

  // CTA / brand footer.
  ctx.fillStyle = "#5c8a72";
  ctx.font = `700 40px ${SANS}`;
  ctx.fillText("game.resios.co", size / 2, 985);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function shareResult(data: ShareData): Promise<"shared" | "downloaded" | "failed"> {
  const text = buildShareText(data);
  const blob = await renderResultCard(data);

  if (blob) {
    const file = new File([blob], "whats-the-rent.png", { type: "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
    };
    if (nav.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: SITE_NAME, text });
        return "shared";
      } catch {
        // Cancelled or failed — fall through to text share / download.
      }
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: SITE_NAME, text });
      return "shared";
    } catch {
      // Fall through to download.
    }
  }

  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whats-the-rent-${data.edition}.png`;
    a.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  }

  return "failed";
}
