"use client";
import { memo } from "react";
import ClubCard from "../components/ClubCard";
import LoadingIndicator from "./LoadingIndicator";
import { categoryEmojis } from "./CategoryData";

const ClubGrid = memo(function ClubGrid({
	clubs,
	selectedCategories,
	totalClubCount,
	viewMode,
	hasMoreClubs,
	loading,
	onClearFilters,
}) {
	return (
		<section className="mb-12 sm:mb-20">
			<div className="flex items-center justify-center mb-6 sm:mb-8">
				<div className="h-px bg-gradient-to-r from-transparent via-lavender dark:via-dark-gradient-start to-transparent w-10 sm:w-16 mr-2 sm:mr-4"></div>
				<h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-dark-base dark:text-white flex items-center flex-wrap justify-center">
					<span className="mr-2">
						{selectedCategories.length === 1
							? categoryEmojis[selectedCategories[0]] || "📄"
							: "📚"}
					</span>
					<span className="truncate max-w-[150px] sm:max-w-none">
						{selectedCategories.length === 1
							? selectedCategories[0]
							: "All Clubs"}
					</span>
					<span className="ml-2 sm:ml-3 text-sm sm:text-base md:text-lg font-normal">
						({clubs.length} of {totalClubCount})
					</span>
				</h2>
				<div className="h-px bg-gradient-to-r from-lavender dark:from-dark-gradient-start via-sky-blue dark:via-dark-gradient-end to-transparent w-10 sm:w-16 ml-2 sm:ml-4"></div>
			</div>

			<div
				className={`${
					viewMode === "grid"
						? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6"
						: "flex flex-col gap-3 sm:gap-4"
				} max-w-6xl mx-auto`}
			>
				{clubs.length > 0 ? (
					clubs.map((club, index) => (
						<div
							key={`${club.id}-${club.instagram || club.name}-${index}`} // More stable key
							className={`${
								viewMode === "grid"
									? "transform transition-transform hover:scale-[1.02] hover:shadow-lg"
									: "w-full"
							} backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/20 dark:border-dark-text/10 overflow-hidden shadow-md fade-in`}
							style={{
								animationDelay: `${Math.min(index * 50, 1000)}ms`, // Cap delay to prevent too long waits
							}}
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
								index={index} // Pass index for better optimization
							/>
						</div>
					))
				) : (
					<div className="col-span-full text-center py-8 sm:py-12 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10">
						<p className="text-dark-base dark:text-dark-text text-lg sm:text-xl mb-2">
							No clubs match your search criteria
						</p>

						<button
							onClick={onClearFilters}
							className="px-4 sm:px-6 py-2 mt-3 sm:mt-4 bg-lavender hover:bg-lavender/80 dark:bg-dark-gradient-start dark:hover:bg-dark-gradient-start/80 text-dark-base dark:text-dark-text-white rounded-full font-medium transition-all text-sm sm:text-base"
						>
							Clear all filters
						</button>

						<p className="mt-4 text-dark-base dark:text-dark-text text-sm sm:text-base">
							Can't find your club?{" "}
							<a
								href="/club/add"
								className="text-dark-base dark:text-dark-text text-lg sm:text-xl font-semibold hover:underline"
							>
								Add it here
							</a>
						</p>
					</div>
				)}
			</div>

			<LoadingIndicator hasMore={hasMoreClubs} loading={loading} />
			<div id="load-more-trigger" className="h-1 w-full"></div>
		</section>
	);
});

export default ClubGrid;
