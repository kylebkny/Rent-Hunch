import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "listing-photos";

function publicPrefix(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
}

/**
 * Copy any externally-hosted photos (e.g. scraped EXR CDN URLs) into our own
 * Supabase Storage bucket, returning the re-hosted public URLs. Photos
 * already in our bucket are left as-is. On any download/upload failure the
 * original URL is kept, so this never loses a photo.
 */
export async function rehostExternalPhotos(
  admin: SupabaseClient,
  photos: string[]
): Promise<string[]> {
  const prefix = publicPrefix();
  const out: string[] = [];

  for (const url of photos) {
    if (!url || url.startsWith(prefix)) {
      out.push(url);
      continue;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) { out.push(url); continue; }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : contentType.includes("avif")
            ? "avif"
            : "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, upsert: false });
      if (error) { out.push(url); continue; }
      out.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    } catch {
      out.push(url);
    }
  }

  return out;
}
