import Link from "next/link";
import { getAdminEmail } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const email = await getAdminEmail();
  if (!email) redirect("/admin/login");
  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-10 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Admin · analytics</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-paper">Rent read</h1>
        </div>
        <Link href="/admin" className="text-sm text-faint hover:text-paper underline">← Listings</Link>
      </header>
      <AdminAnalytics />
    </main>
  );
}
