import { AdminSidenav } from "@/components/admin-sidenav";
import { requireAdmin } from "@/lib/admin/access";
import { loadAdminNotificationChrome } from "@/lib/notifications/badges";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const chrome = await loadAdminNotificationChrome();

  return (
    <div className="flex flex-1">
      <AdminSidenav
        badges={{
          "/admin": chrome.overview,
          "/admin/billing": chrome.billing,
          "/admin/affiliates": chrome.affiliates,
          "/admin/members": chrome.members,
        }}
      />
      <div className="min-w-0 flex-1 px-6 py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    </div>
  );
}
