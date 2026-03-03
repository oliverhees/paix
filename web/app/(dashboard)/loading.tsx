/**
 * Dashboard loading.tsx — shown by Next.js while the dashboard page suspends.
 * Provides a visible loading state instead of a blank white page.
 */
export default function DashboardLoading() {
  return (
    <div
      className="flex h-[50vh] flex-col items-center justify-center gap-3"
      style={{ minHeight: "200px" }}
    >
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      <p className="text-muted-foreground text-sm">Laden...</p>
    </div>
  );
}
