import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { SYSTEM_JOBS } from "@/lib/admin/system-jobs";

export const metadata: Metadata = {
  title: "System",
  description: "Maintenance jobs the platform runs.",
};

export default function AdminSystemPage() {
  return (
    <div>
      <PageHeading overline="Admin" title="System" />
      <p className="mt-4 max-w-3xl text-sm text-ink-muted">
        Jobs that keep the books, the logs, and the billing ledger moving.
        Database migrations, the Fly deploy, and the Vercel deploy run from
        GitHub Actions on push. They are not listed here.
      </p>
      <ol className="mt-6 space-y-4">
        {SYSTEM_JOBS.map((job) => (
          <li
            key={job.id}
            className="rounded-card border border-line bg-surface p-5"
          >
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              {job.name}
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-ink-faint">
                  Runs
                </dt>
                <dd className="mt-1 text-ink">{job.runs}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-ink-faint">
                  Cadence
                </dt>
                <dd className="mt-1 text-ink">{job.cadence}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-ink-faint">
                  What it does
                </dt>
                <dd className="mt-1 text-ink-muted">{job.detail}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-ink-faint">
                  What it leaves
                </dt>
                <dd className="mt-1 text-ink-muted">{job.leaves}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </div>
  );
}
