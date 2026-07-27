import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { parseStreetEasyUrl, parseListingHtml, isStreetEasyUrl } from "@/lib/streeteasy";
import { deriveTransit } from "@/lib/transit";
import { createAdminClient } from "@/lib/supabase/admin";
import { rehostExternalPhotos } from "@/lib/exr/rehost";

export const maxDuration = 30;

interface ImportBody {
  url?: string;
  /** Page source pasted by the admin when our own fetch gets blocked. */
  html?: string;
}

/**
 * Best-effort fetch of a StreetEasy page. StreetEasy fronts its pages with bot
 * protection, so this is expected to fail some of the time — the caller falls
 * back to what the URL alone tells us, and the admin can paste the page source
 * to fill in the rest.
 */
async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    // A captcha/challenge page is a 200 with no listing content in it.
    if (/px-captcha|perimeterx|are you a human|unusual traffic/i.test(html)) return null;
    return html;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ImportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = body.url?.trim() ?? "";
  const pastedHtml = body.html?.trim() ?? "";

  if (!url && !pastedHtml) {
    return NextResponse.json({ error: "Paste a StreetEasy link" }, { status: 400 });
  }
  if (url && !isStreetEasyUrl(url)) {
    return NextResponse.json({ error: "That doesn't look like a streeteasy.com link" }, { status: 400 });
  }

  const parts = url ? parseStreetEasyUrl(url) : null;

  // Pasted source wins — it's the page the admin actually saw.
  const html = pastedHtml || (url ? await tryFetch(url) : null);
  const fields = html ? parseListingHtml(html) : null;

  // The URL slug is authoritative for the street address; the page is
  // authoritative for everything else.
  const address = parts?.address ?? fields?.address ?? null;
  const borough = parts?.borough ?? fields?.borough ?? null;
  const neighborhood = fields?.neighborhood ?? null;

  // Copy photos into our own bucket — hotlinking Zillow's CDN would break the
  // moment they add referrer checks.
  const photos = fields?.photos.length
    ? await rehostExternalPhotos(createAdminClient(), fields.photos)
    : [];

  const filled: string[] = [];
  if (address) filled.push("address");
  if (neighborhood) filled.push("neighborhood");
  if (borough) filled.push("borough");
  if (fields?.rent != null) filled.push("rent");
  if (fields?.beds != null) filled.push("beds");
  if (fields?.baths != null) filled.push("baths");
  if (fields?.sqft != null) filled.push("sqft");
  if (photos.length) filled.push(`${photos.length} photos`);

  return NextResponse.json({
    ok: true,
    // True when we couldn't read the page at all — the admin can paste source.
    blocked: !html,
    listing: {
      listing_url: parts?.canonicalUrl ?? url ?? null,
      address: address && parts?.unit ? `${address} #${parts.unit}` : address,
      geocode_address: address ? [address, borough, "NY"].filter(Boolean).join(", ") : null,
      unit: parts?.unit ?? null,
      neighborhood,
      city: borough,
      beds: fields?.beds ?? null,
      baths: fields?.baths ?? null,
      sqft: fields?.sqft ?? null,
      actual_rent: fields?.rent ?? null,
      amenities: fields?.amenities ?? [],
      photos,
      transit: neighborhood ? deriveTransit(neighborhood) : "",
    },
    filled,
  });
}
