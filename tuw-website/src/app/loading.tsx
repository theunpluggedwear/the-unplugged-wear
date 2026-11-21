import { Skeleton } from '@storefront/components/ui';

// Route-level loading UI for storefront navigations (Cache Components
// "instant navigation"): a calm editorial shell that holds the same width
// rhythm as the pages while their server reads stream in. No marketing copy,
// urgency or fabricated content — just a quiet placeholder.
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-store-canvas" aria-busy="true" aria-label="Loading">
      <div className="w-full border-b border-store-card-border/60 bg-store-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <Skeleton height={20} width={140} />
          <div className="hidden md:flex items-center gap-6" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={12} width={64 + i * 8} />
            ))}
          </div>
          <Skeleton height={36} width={96} />
        </div>
      </div>
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        <div className="space-y-3">
          <Skeleton height={12} width={96} />
          <Skeleton height={28} width="45%" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="aspect-4/5 w-full" />
              <Skeleton height={12} width="80%" />
              <Skeleton height={12} width="50%" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
