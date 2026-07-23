import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runExrSync } from "@/lib/exr/sync";

// Same time budget as the cron.
export const maxDuration = 60;

/** Admin-triggered EXR sync (no cron secret exposed to the client). */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  const result = await runExrSync(admin, 30);
  if ("empty" in result) {
    return NextResponse.json({ ok: true, empty: true });
  }
  return NextResponse.json({ ok: true, ...result });
}
