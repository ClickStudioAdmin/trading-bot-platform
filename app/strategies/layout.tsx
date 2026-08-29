import { AppSidenavShell } from "@/components/app-sidenav-shell";

export default function StrategiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppSidenavShell>{children}</AppSidenavShell>;
}
