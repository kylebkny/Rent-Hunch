import { MAX_POSSIBLE_SCORE, guessTrailEmoji, type WarmthBand } from "@/lib/scoring";
import { SITE_NAME } from "@/lib/brand";

export interface ShareData {
  edition: number;
  score: number;
  actualRent: number;
  bands: WarmthBand[];
}

export function buildShareText({ edition, score, bands }: ShareData): string {
  const trail = guessTrailEmoji(bands);
  return `${SITE_NAME} #${edition} — ${trail} — ${score}/${MAX_POSSIBLE_SCORE} pts`;
}

export async function renderResultCard(data: ShareData): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const sans =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif";

  // Black canvas, matching the app.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";

  ctx.fillStyle = "#9ca3af";
  ctx.font = `600 34px ${sans}`;
  ctx.fillText(`${SITE_NAME.toUpperCase()} #${data.edition}`, canvas.width / 2, 200);

  // White "card" with the actual rent, tilted like the in-app stamp.
  ctx.save();
  ctx.translate(canvas.width / 2, 470);
  ctx.rotate(-0.07);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, -300, -130, 600, 260, 36);
  ctx.fill();
  ctx.fillStyle = "#9ca3af";
  ctx.font = `600 26px ${sans}`;
  ctx.fillText("ACTUAL RENT", 0, -40);
  ctx.fillStyle = "#0f1420";
  ctx.font = `800 96px ${sans}`;
  ctx.fillText(`$${data.actualRent.toLocaleString()}`, 0, 60);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 60px ${sans}`;
  ctx.fillText(`${data.score} / ${MAX_POSSIBLE_SCORE} pts`, canvas.width / 2, 720);

  ctx.font = "64px sans-serif";
  ctx.fillText(guessTrailEmoji(data.bands), canvas.width / 2, 830);

  ctx.fillStyle = "#6b7280";
  ctx.font = `500 30px ${sans}`;
  ctx.fillText("game.resios.co", canvas.width / 2, 960);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
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
    const file = new File([blob], "rent-hunch.png", { type: "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
    };

    if (nav.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: "Rent Hunch", text });
        return "shared";
      } catch {
        // User cancelled or share failed — fall through to text share / download.
      }
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: "Rent Hunch", text });
      return "shared";
    } catch {
      // Fall through to download.
    }
  }

  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent-hunch-${data.edition}.png`;
    a.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  }

  return "failed";
}
