import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface ListingBody {
  neighborhood?: string;
  city?: string;
  beds?: number;
  baths?: number;
  sqft?: number | null;
  amenities?: string[];
  transit?: string;
  nearby?: string | null;
  actual_rent?: number;
  photos?: string[];
  listing_url?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  review_status?: "draft" | "ready";
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load listings" }, { status: 500 });
  }
  return NextResponse.json({ listings: data });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ListingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const errors: string[] = [];
  if (!body.neighborhood?.trim()) errors.push("neighborhood");
  if (typeof body.beds !== "number") errors.push("beds");
  if (typeof body.baths !== "number") errors.push("baths");
  if (typeof body.actual_rent !== "number" || body.actual_rent <= 0) errors.push("rent");
  if (!body.transit?.trim()) errors.push("transit");
  if (errors.length > 0) {
    return NextResponse.json({ error: `Missing/invalid: ${errors.join(", ")}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listings")
    .insert({
      neighborhood: body.neighborhood!.trim(),
      city: body.city?.trim() || "Brooklyn",
      beds: body.beds,
      baths: body.baths,
      sqft: body.sqft ?? null,
      amenities: body.amenities ?? [],
      transit: body.transit!.trim(),
      nearby: body.nearby?.trim() || null,
      actual_rent: body.actual_rent,
      photos: body.photos ?? [],
      listing_url: body.listing_url?.trim() || null,
      address: body.address?.trim() || null,
      lat: typeof body.lat === "number" ? body.lat : null,
      lng: typeof body.lng === "number" ? body.lng : null,
      source: "manual",
      review_status: body.review_status ?? "ready",
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not create listing" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
