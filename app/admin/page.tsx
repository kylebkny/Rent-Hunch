import { redirect } from "next/navigation";
import { getAdminEmail } from "@/lib/admin-auth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const email = await getAdminEmail();
  if (!email) {
    redirect("/admin/login");
  }
  return <AdminDashboard adminEmail={email} />;
}
