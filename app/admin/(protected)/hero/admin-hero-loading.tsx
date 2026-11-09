/** Skeleton for hero admin routes. Gives each page its own Suspense boundary, so client navigations between admin tabs don't block on the auth check. */
export function AdminHeroLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8" aria-busy="true">
      <div className="h-8 w-40 animate-pulse bg-sand" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse bg-sand/70" />
        ))}
      </div>
    </div>
  );
}
