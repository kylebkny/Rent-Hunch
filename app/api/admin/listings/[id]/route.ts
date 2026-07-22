import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface PatchBody {
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
  review_status?: "draft" | "ready";
  status?: "active" | "used";
  is_off_market?: boolean;
}

const ALLOWED_FIELDS: (keyof PatchBody)[] = [
  "neighborhood", "city", "beds", "baths", "sqft", "amenities",
  "transit", "nearby", "actual_rent", "photos", "review_status", "status",
  "is_off_market",
];

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("listings").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Could not update listing" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const admin = createAdminClient();

  // Refuse to delete a listing that has already been used as a challenge
  // (guesses/challenges reference it).
  const { data: challenge } = await admin
    .from("daily_challenges")
    .select("id")
    .eq("listing_id", id)
    .maybeSingle();
  if (challenge) {
    return NextResponse.json(
      { error: "Listing has been featured in a challenge and can't be deleted" },
      { status: 409 }
    );
  }

  const { error } = await admin.from("listings").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Could not delete listing" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
