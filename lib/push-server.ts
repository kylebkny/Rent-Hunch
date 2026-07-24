import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;
function configure(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:kyle.bkny@gmail.com", pub, priv);
    configured = true;
  }
  return true;
}

/** Send the daily "new puzzle" push to every subscriber. No-op if push
 *  isn't configured. Expired subscriptions are pruned. */
export async function sendDailyPush(admin: SupabaseClient, edition: number): Promise<number> {
  if (!configure()) return 0;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (!subs || subs.length === 0) return 0;

  const payload = JSON.stringify({
    title: "What's the Rent",
    body: `#${edition} is up — can you price it?`,
    url: "/",
  });

  let sent = 0;
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode ?? 0;
        if (code === 404 || code === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    })
  );
  return sent;
}
