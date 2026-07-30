export default function DashboardSkeleton() {
  return (
    <div
      data-testid="dashboard-skeleton"
      aria-label="正在加载账号数据"
      aria-live="polite"
      className="animate-pulse"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[86px] rounded-xl border border-border bg-panel p-4">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-4 h-6 w-14 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="mb-6 flex items-center justify-between border-b border-border bg-background py-3">
        <div className="h-9 w-full max-w-md rounded-lg bg-muted" />
        <div className="ml-4 h-8 w-24 rounded-lg bg-muted" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-64 rounded-xl border border-border bg-panel p-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-5 w-14 rounded bg-muted" />
            </div>
            <div className="mt-4 space-y-4">
              <div className="h-8 rounded bg-muted/80" />
              <div className="h-6 rounded bg-muted/80" />
              <div className="h-6 rounded bg-muted/80" />
            </div>
            <div className="mt-5 h-8 rounded bg-muted/80" />
          </div>
        ))}
      </div>
    </div>
  );
}
