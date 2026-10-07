"use client";
import { memo } from "react";
import ClubCard from "../components/ClubCard";
import LoadingIndicator from "./LoadingIndicator";

const ClubGrid = memo(function ClubGrid({
  clubs,
  selectedCategories,
  totalClubCount,
  hasMoreClubs,
  loading,
  onClearFilters,
}) {
  const title =
    selectedCategories.length === 1 ? selectedCategories[0] : "All Clubs";

  return (
    <section className="mb-12 sm:mb-20">
      {/* The visible count lives in the page header; keep the heading for structure. */}
      <h2 className="sr-only">
        {title} ({clubs.length} of {totalClubCount})
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clubs.length > 0 ? (
          clubs.map((club, index) => (
            <div
              key={`${club.id}-${club.instagram_handle || club.name}-${index}`}
              className="h-full"
              style={{ animationDelay: `${Math.min(index * 50, 1000)}ms` }}
            >
              <ClubCard
                club={{
                  id: club.id,
                  profilePicture: club.profile_image_path || club.profile_pic,
                  name: club.name,
                  description: club.description,
                  instagram: club.instagram_handle,
                  categories: club.categories,
                }}
                index={index}
              />
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-xl border border-border bg-card px-6 py-12 text-center">
            <p className="mb-2 text-lg text-foreground sm:text-xl">
              No clubs match your search criteria
            </p>
            <button
              type="button"
              onClick={onClearFilters}
              className="instinct-btn mt-4 rounded-full px-5 py-2 text-sm font-medium text-white"
            >
              Clear all filters
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              Can&apos;t find your club?{" "}
              <a
                href="/club/add"
                className="font-semibold text-foreground hover:underline"
              >
                Add it here
              </a>
            </p>
          </div>
        )}
      </div>

      <LoadingIndicator hasMore={hasMoreClubs} loading={loading} />
      <div id="load-more-trigger" className="h-1 w-full" />
    </section>
  );
});

export default ClubGrid;
