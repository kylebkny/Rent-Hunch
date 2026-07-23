import { MAX_POSSIBLE_SCORE, type WarmthBand } from "@/lib/scoring";
import { SITE_NAME } from "@/lib/brand";

export interface ShareData {
  edition: number;
  score: number;
  bands: WarmthBand[];
  guessesUsed: number;
}

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif";

// Warmth as temperature (hot→cold), our own identity — not Wordle's grid.
function warmthColor(band: WarmthBand): string {
  if (band === "exact" || band === "veryClose") return "#16a34a"; // hot / on it
  if (band === "close" || band === "warm") return "#e08a2b"; // warm (orange, not Wordle yellow)
  return "#b4432e"; // cold (rust)
}

function warmthCircle(band: WarmthBand): string {
  if (band === "exact" || band === "veryClose") return "🟢";
  if (band === "close" || band === "warm") return "🟠";
  return "🔴";
}

// Non-spoiling text: warmth circles + score, no actual rent.
export function buildShareText({ edition, score, bands, guessesUsed }: ShareData): string {
  const trail = (bands.length ? bands : (["cold"] as WarmthBand[])).map(warmthCircle).join("");
  const g = guessesUsed === 1 ? "1 guess" : `${guessesUsed} guesses`;
  return `${SITE_NAME} #${edition}\n${trail}  ${score}/${MAX_POSSIBLE_SCORE} in ${g}\ngame.resios.co`;
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

/** Hand-drawn-ish apartment facade — the game's real-estate motif. */
function drawBuilding(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number) {
  const left = cx - w / 2;
  const right = cx + w / 2;
  const bottom = top + h;
  const roofY = top + h * 0.16;

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Silhouette with a slight peak.
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, roofY);
  ctx.lineTo(cx, top);
  ctx.lineTo(right, roofY);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  // Ground line.
  ctx.beginPath();
  ctx.moveTo(left - 34, bottom);
  ctx.lineTo(right + 34, bottom);
  ctx.stroke();

  // Windows (3×3), a few "lit" in ledger-green.
  const cols = 3;
  const rows = 3;
  const marginX = w * 0.16;
  const gridTop = roofY + h * 0.1;
  const gridBottom = bottom - h * 0.24;
  const gapX = w * 0.09;
  const gapY = h * 0.07;
  const winW = (w - marginX * 2 - gapX * (cols - 1)) / cols;
  const winH = (gridBottom - gridTop - gapY * (rows - 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = left + marginX + c * (winW + gapX);
      const y = gridTop + r * (winH + gapY);
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = "rgba(92,138,114,0.55)";
        ctx.fillRect(x, y, winW, winH);
      }
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, winW, winH);
    }
  }

  // Door.
  const doorW = w * 0.17;
  const doorH = h * 0.19;
  ctx.lineWidth = 4;
  ctx.strokeRect(cx - doorW / 2, bottom - doorH, doorW, doorH);
}

export async function renderResultCard(data: ShareData): Promise<Blob | null> {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#1b2230";
  ctx.lineWidth = 2;
  roundRect(ctx, 40, 40, size - 80, size - 80, 44);
  ctx.stroke();

  ctx.textAlign = "center";

  // Wordmark + edition (editorial, uppercase).
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 62px ${SANS}`;
  ctx.fillText(SITE_NAME.toUpperCase(), size / 2, 175);
  ctx.fillStyle = "#9ca3af";
  ctx.font = `600 38px ${SANS}`;
  ctx.fillText(`#${data.edition}`, size / 2, 230);

  // Building motif — the real-estate identity.
  drawBuilding(ctx, size / 2, 285, 300, 300);

  // Score.
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 128px ${SANS}`;
  ctx.fillText(String(data.score), size / 2, 745);
  ctx.fillStyle = "#9ca3af";
  ctx.font = `600 40px ${SANS}`;
  const g = data.guessesUsed === 1 ? "1 guess" : `${data.guessesUsed} guesses`;
  ctx.fillText(`/ ${MAX_POSSIBLE_SCORE} pts · in ${g}`, size / 2, 805);

  // Warmth as rounded pills (temperature read, not a Wordle grid).
  const bands = data.bands.length ? data.bands : (["cold"] as WarmthBand[]);
  const pw = bands.length > 4 ? 120 : 140;
  const ph = 44;
  const gap = 22;
  const totalW = bands.length * pw + (bands.length - 1) * gap;
  let x = (size - totalW) / 2;
  const y = 860;
  for (const band of bands) {
    ctx.fillStyle = warmthColor(band);
    roundRect(ctx, x, y, pw, ph, ph / 2);
    ctx.fill();
    x += pw + gap;
  }

  // Footer CTA.
  ctx.fillStyle = "#5c8a72";
  ctx.font = `700 40px ${SANS}`;
  ctx.fillText("game.resios.co", size / 2, 985);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
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
        // Cancelled or failed — fall through.
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
