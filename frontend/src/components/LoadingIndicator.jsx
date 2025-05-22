export default function LoadingIndicator({ hasMore, loading }) {
  if (!hasMore) return null;

  return (
    <div className="text-center mt-6 sm:mt-8">
      <div className="inline-block px-4 sm:px-6 py-2 sm:py-3 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-full border border-white/20 dark:border-dark-text/10 shadow-md text-sm sm:text-base">
        {loading ? (
          <div className="flex items-center">
            <div className="animate-spin mr-2 h-3 w-3 sm:h-4 sm:w-4 border-2 border-lavender dark:border-dark-gradient-start border-t-transparent dark:border-t-transparent rounded-full"></div>
            <span className="text-dark-base dark:text-dark-text">Loading more clubs...</span>
          </div>
        ) : (
          <span className="text-dark-base dark:text-dark-text">Scroll for more clubs</span>
        )}
      </div>
    </div>
  );
}