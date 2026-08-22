import { AdminSubnav } from "@/components/admin-subnav";
import { requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div>
      <AdminSubnav />
      {children}
    </div>
  );
}
