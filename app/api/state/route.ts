import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ROUND = 3;

interface StateBody {
  challenge_id?: string;
  current_round?: number;
}

export async function PATCH(request: Request) {
  const authClient = await createAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: StateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { challenge_id, current_round } = body;
  if (
    !challenge_id ||
    typeof current_round !== "number" ||
    !Number.isInteger(current_round) ||
    current_round < 0 ||
    current_round > MAX_ROUND
  ) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Already-locked players don't get to rewind their round.
  const { data: existingGuess } = await admin
    .from("guesses")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challenge_id)
    .maybeSingle();

  if (existingGuess) {
    return NextResponse.json(
      { error: "You've already played today's challenge" },
      { status: 409 }
    );
  }

  const { error } = await admin.from("game_state").upsert(
    {
      user_id: user.id,
      challenge_id,
      current_round,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,challenge_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Could not save state" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
