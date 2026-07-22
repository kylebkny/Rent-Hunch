import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_NAME = 20;

function sanitizeName(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0)!;
    // Drop C0/C1 control characters; keep everything else printable.
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) continue;
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

export async function PATCH(request: Request) {
  const authClient = await createAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { display_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = sanitizeName(body.display_name ?? "");
  if (!name) {
    return NextResponse.json({ error: "Name is empty" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .upsert({ user_id: user.id, display_name: name }, { onConflict: "user_id" });
  if (error) {
    return NextResponse.json({ error: "Could not save name" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, display_name: name });
}
