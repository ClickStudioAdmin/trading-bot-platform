import Link from "next/link";
import { IconChevronRight } from "@/components/icons";

export type BreadcrumbItem = {
  href?: string;
  label: string;
};

export function Breadcrumbs({
  items,
  className = "-mt-4 mb-6",
}: {
  items: readonly BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 text-hint text-ink-faint">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-x-1.5">
              {index > 0 ? (
                <IconChevronRight
                  size={12}
                  className="size-3 shrink-0 text-ink-faint"
                />
              ) : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="truncate text-ink-muted hover:text-ink"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="truncate"
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
