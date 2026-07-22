import { MAX_POSSIBLE_SCORE, roundTrailEmoji } from "@/lib/scoring";

export interface ShareData {
  edition: number;
  round: number;
  score: number;
  actualRent: number;
}

export function buildShareText({ edition, round, score }: ShareData): string {
  const trail = roundTrailEmoji(round);
  return `Rent Hunch #${edition} — ${trail} — ${score}/${MAX_POSSIBLE_SCORE} pts`;
}

export async function renderResultCard(data: ShareData): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#14181f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#d9cfba";
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

  ctx.textAlign = "center";
  ctx.fillStyle = "#eee6d8";
  ctx.font = "600 44px Georgia, serif";
  ctx.fillText(`RENT HUNCH #${data.edition}`, canvas.width / 2, 220);

  ctx.save();
  ctx.translate(canvas.width / 2, 480);
  ctx.rotate(-0.08);
  ctx.strokeStyle = "#b4432e";
  ctx.lineWidth = 8;
  ctx.strokeRect(-260, -110, 520, 220);
  ctx.fillStyle = "#b4432e";
  ctx.font = "700 90px Georgia, serif";
  ctx.fillText(`$${data.actualRent.toLocaleString()}`, 0, 30);
  ctx.restore();

  ctx.fillStyle = "#eee6d8";
  ctx.font = "500 56px Georgia, serif";
  ctx.fillText(`${data.score}/1000 pts`, canvas.width / 2, 700);

  ctx.font = "64px sans-serif";
  ctx.fillText(roundTrailEmoji(data.round), canvas.width / 2, 800);

  ctx.fillStyle = "#5c8a72";
  ctx.font = "400 32px monospace";
  ctx.fillText("game.resios.co", canvas.width / 2, 950);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
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
