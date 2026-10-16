import { IconLoader } from "@/components/icons";

export default function ReplayLoading() {
  return (
    <div>
      <div className="-mt-4 mb-6 h-4" aria-hidden />
      <div className="space-y-4">
        <div className="h-14" aria-hidden />
        <section className="min-h-[420px] w-full min-w-0 overflow-hidden rounded-card border border-line bg-canvas">
          <div className="h-9 border-b border-line" aria-hidden />
          <div className="relative h-[min(62vh,640px)] min-h-[420px] w-full min-w-0">
            <div
              className="absolute inset-0 flex items-center justify-center"
              role="status"
              aria-label="Loading candles"
            >
              <IconLoader className="size-16 animate-spin text-accent" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
