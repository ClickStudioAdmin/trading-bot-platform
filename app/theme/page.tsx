import { redirect } from "next/navigation";

export default function ThemeRedirectPage() {
  redirect("/admin/theme");
}
