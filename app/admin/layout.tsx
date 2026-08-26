import { AdminSidenav } from "@/components/admin-sidenav";
import { requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex flex-1">
      <AdminSidenav />
      <div className="min-w-0 flex-1 px-6 py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    </div>
  );
}
