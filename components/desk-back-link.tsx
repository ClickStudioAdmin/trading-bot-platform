import Link from "next/link";
import { IconArrowLeft } from "@/components/icons";

export function DeskBackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
    >
      <IconArrowLeft size={16} className="size-4" />
      Back
    </Link>
  );
}
