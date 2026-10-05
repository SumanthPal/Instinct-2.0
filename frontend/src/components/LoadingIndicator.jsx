export default function LoadingIndicator({ hasMore, loading }) {
  if (!hasMore) return null;

  return (
    <div className="mt-6 text-center sm:mt-8">
      <div className="inline-flex items-center rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-muted-foreground shadow-sm sm:px-6 sm:py-3 sm:text-base">
        {loading ? (
          <>
            <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent sm:h-4 sm:w-4" />
            <span>Loading more clubs...</span>
          </>
        ) : (
          <span>Scroll for more clubs</span>
        )}
      </div>
    </div>
  );
}
