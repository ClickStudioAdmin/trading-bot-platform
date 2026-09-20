import { redirect } from "next/navigation";

export default function BookOverviewRedirect() {
  redirect("/account");
}
