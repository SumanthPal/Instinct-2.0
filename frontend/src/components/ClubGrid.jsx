"use client";
import { memo } from "react";
import ClubCard from "../components/ClubCard";
import LoadingIndicator from "./LoadingIndicator";

const ClubGrid = memo(function ClubGrid({
  clubs,
  selectedCategories,
  totalClubCount,
  viewMode,
  hasMoreClubs,
  loading,
  onClearFilters,
}) {
  const title =
    selectedCategories.length === 1 ? selectedCategories[0] : "All Clubs";

  return (
    <section className="mb-12 sm:mb-20">
      <div className="mb-6 flex items-center justify-center sm:mb-8">
        <div className="mr-3 h-px w-10 bg-gradient-to-r from-transparent via-border to-transparent sm:mr-4 sm:w-16" />
        <h2 className="flex flex-wrap items-center justify-center text-xl font-semibold tracking-tight text-foreground sm:text-2xl md:text-3xl">
          <span className="truncate max-w-[180px] sm:max-w-none">{title}</span>
          <span className="ml-2 text-sm font-normal text-muted-foreground sm:ml-3 sm:text-base md:text-lg">
            ({clubs.length} of {totalClubCount})
          </span>
        </h2>
        <div className="ml-3 h-px w-10 bg-gradient-to-r from-transparent via-border to-transparent sm:ml-4 sm:w-16" />
      </div>

      <div
        className={`${
          viewMode === "grid"
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 md:gap-6"
            : "flex flex-col gap-3 sm:gap-4"
        } mx-auto max-w-6xl`}
      >
        {clubs.length > 0 ? (
          clubs.map((club, index) => (
            <div
              key={`${club.id}-${club.instagram_handle || club.name}-${index}`}
              className={viewMode === "grid" ? "h-full" : "w-full"}
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
                viewMode={viewMode}
                index={index}
              />
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-xl border border-border bg-card/60 px-6 py-12 text-center">
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
