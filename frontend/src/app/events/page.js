"use client";

import { useState, useEffect } from "react";
import { format, startOfDay, isSameDay, parseISO } from "date-fns";
import { fetchCampusWideEvents } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import { FaCalendarAlt, FaMapMarkerAlt, FaClock, FaChevronDown, FaUserCircle } from "react-icons/fa";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

const GCS_BUCKET_URL = "https://storage.googleapis.com/uci-club-bucket";
const INITIAL_LOAD = 12;
const LOAD_MORE_COUNT = 12;

export default function CampusEventsPage() {
	const [allEvents, setAllEvents] = useState([]);
	const [displayedEvents, setDisplayedEvents] = useState([]);
	const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD);
	const [isLoading, setIsLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedImage, setSelectedImage] = useState(null);
	const [selectedImageData, setSelectedImageData] = useState(null);

	// Get profile picture URL from instagram handle
	const getClubProfilePic = (instagramHandle) => {
		if (!instagramHandle) return null;
		return `${GCS_BUCKET_URL}/pfps/${instagramHandle}.jpg`;
	};

	// Fetch all upcoming events
	useEffect(() => {
		const loadEvents = async () => {
			setIsLoading(true);
			try {
				const now = startOfDay(new Date());
				const data = await fetchCampusWideEvents(
					now.toISOString(),
					null,
					10000,
					0
				);
				console.log("Loaded upcoming events:", data);
				const sortedEvents = (data.results || []).sort((a, b) => {
					const dateA = getEventDate(a);
					const dateB = getEventDate(b);
					return dateA - dateB;
				});
				setAllEvents(sortedEvents);
				setDisplayedEvents(sortedEvents.slice(0, INITIAL_LOAD));
			} catch (error) {
				console.error("Failed to load events:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadEvents();
	}, []);

	const handleImageClick = (imageUrl, imageData = null) => {
		setSelectedImage(imageUrl);
		setSelectedImageData(imageData);
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setSelectedImage(null);
		setSelectedImageData(null);
	};

	const loadMore = () => {
		const newCount = visibleCount + LOAD_MORE_COUNT;
		setDisplayedEvents(allEvents.slice(0, newCount));
		setVisibleCount(newCount);
	};

	// Get event date
	const getEventDate = (event) => {
		if (!event) return null;
		try {
			if (event.date) {
				return new Date(event.date);
			}
			if (event.parsed?.Date) {
				return new Date(event.parsed.Date);
			}
		} catch (e) {
			console.error("Failed to parse date for event", event, e);
		}
		return null;
	};

	// Group events by date
	const groupEventsByDate = (events) => {
		const grouped = {};
		events.forEach(event => {
			const eventDate = getEventDate(event);
			if (eventDate) {
				const dateKey = format(eventDate, "yyyy-MM-dd");
				if (!grouped[dateKey]) {
					grouped[dateKey] = {
						date: eventDate,
						events: []
					};
				}
				grouped[dateKey].events.push(event);
			}
		});
		return Object.values(grouped).sort((a, b) => a.date - b.date);
	};

	// Close modal on ESC key
	useEffect(() => {
		const handleEscKey = (event) => {
			if (event.key === "Escape" && isModalOpen) {
				closeModal();
			}
		};

		document.addEventListener("keydown", handleEscKey);
		return () => document.removeEventListener("keydown", handleEscKey);
	}, [isModalOpen]);

	// Loading state
	if (isLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
				<Navbar />
				<main className="container mx-auto px-4 py-24 flex items-center justify-center">
					<div className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 p-8 rounded-xl shadow-lg text-center border border-white/20 dark:border-dark-text/10">
						<div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-lavender dark:border-dark-gradient-start border-t-transparent dark:border-t-transparent mb-4"></div>
						<h2 className="text-xl font-medium text-dark-base dark:text-dark-text">
							Loading Upcoming Events...
						</h2>
					</div>
				</main>
				<Footer />
			</div>
		);
	}

	const groupedEvents = groupEventsByDate(displayedEvents);
	const hasMore = visibleCount < allEvents.length;

	return (
		<div className="min-h-screen overflow-hidden bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
			<Navbar />

			<main className="container mx-auto px-3 sm:px-4 pt-[100px] sm:pt-[120px] pb-10 sm:pb-16 md:pb-20">
				{/* Heading */}
				<div className="mb-8 sm:mb-12 text-center">
					<h1 className="text-4xl sm:text-5xl font-bold mb-3 text-dark-base dark:text-white">
						Upcoming Events
					</h1>
					<p className="text-dark-base dark:text-dark-subtext text-base sm:text-lg mb-4">
						Discover what's happening at UCI
					</p>
					<div className="inline-flex items-center gap-2 px-4 py-2 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-full border border-white/20 dark:border-dark-text/10">
						<div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
						<p className="text-sm sm:text-base font-semibold text-dark-base dark:text-dark-text">
							{allEvents.length} upcoming events
						</p>
					</div>
				</div>

				{/* Events List - Grouped by Date */}
				{groupedEvents.length > 0 ? (
					<div className="space-y-8 sm:space-y-10">
						{groupedEvents.map((group, groupIndex) => (
							<div key={groupIndex} className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10 shadow-lg p-4 sm:p-6 lg:p-8">
								{/* Date Header */}
								<div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/20 dark:border-dark-text/10">
									<div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-lavender/30 dark:bg-dark-gradient-start/30 border-2 border-lavender dark:border-dark-gradient-start">
										<div className="text-center">
											<div className="text-xs sm:text-sm font-semibold text-dark-base dark:text-dark-text uppercase">
												{format(group.date, "MMM")}
											</div>
											<div className="text-lg sm:text-xl font-bold text-dark-base dark:text-dark-text">
												{format(group.date, "d")}
											</div>
										</div>
									</div>
									<div>
										<h2 className="text-xl sm:text-2xl font-bold text-dark-base dark:text-white">
											{format(group.date, "EEEE, MMMM d, yyyy")}
										</h2>
										<p className="text-sm text-dark-base/60 dark:text-dark-text/60">
											{group.events.length} event{group.events.length !== 1 ? "s" : ""}
										</p>
									</div>
								</div>

								{/* Events Grid for this Date */}
								<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
									{group.events.map((event, index) => {
										const clubProfilePic = event.clubs?.instagram_handle
											? getClubProfilePic(event.clubs.instagram_handle)
											: null;

										return (
											<div
												key={`event-${groupIndex}-${index}`}
												className="group backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/30 dark:border-dark-text/20 overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
											>
												{/* Event Image */}
												{event.image_url && (
													<div
														className="relative w-full h-48 sm:h-56 cursor-pointer overflow-hidden"
														onClick={() => handleImageClick(event.image_url, event)}
													>
														<Image
															src={event.image_url}
															alt="Event Image"
															fill
															className="object-cover group-hover:scale-110 transition-transform duration-300"
															sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
															loading="lazy"
															unoptimized
														/>
														<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
													</div>
												)}

												<div className="p-4 sm:p-5">
													{/* Club Info */}
													{event.clubs && (
														<Link
															href={`/club/${event.clubs.instagram_handle}`}
															className="inline-flex items-center gap-2 mb-3 group/club hover:opacity-80 transition-opacity"
														>
															<div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white/50 dark:border-dark-text/20 flex-shrink-0 bg-gray-200 dark:bg-gray-700">
																{clubProfilePic ? (
																	<Image
																		src={clubProfilePic}
																		alt={event.clubs.name}
																		fill
																		className="object-cover"
																		sizes="32px"
																		unoptimized
																		onError={(e) => {
																			e.target.style.display = 'none';
																			e.target.nextSibling.style.display = 'flex';
																		}}
																	/>
																) : null}
																<div className="absolute inset-0 flex items-center justify-center" style={{ display: clubProfilePic ? 'none' : 'flex' }}>
																	<FaUserCircle className="w-6 h-6 text-gray-400" />
																</div>
															</div>
															<span className="text-sm font-semibold text-dark-base dark:text-dark-text group-hover/club:underline">
																{event.clubs.name}
															</span>
														</Link>
													)}

													{/* Event Title */}
													<h4 className="text-lg sm:text-xl font-bold text-dark-base dark:text-white mb-2 line-clamp-2">
														{event.parsed?.Name || event.name || "Event"}
													</h4>

													{/* Event Details */}
													<p className="text-sm sm:text-base text-dark-base/70 dark:text-dark-text/70 mb-4 line-clamp-2">
														{event.parsed?.Details ||
															event.details ||
															"No details available"}
													</p>

													{/* Event Meta Info */}
													<div className="space-y-2 text-sm text-dark-base/60 dark:text-dark-text/60">
														{/* Time */}
														<div className="flex items-center gap-2">
															<FaClock className="w-4 h-4 flex-shrink-0" />
															<span className="truncate">
																{event.parsed?.Date
																	? format(new Date(event.parsed.Date), "p")
																	: event.date
																		? format(new Date(event.date), "p")
																		: "Time TBA"}
															</span>
														</div>

														{/* Location */}
														{(event.parsed?.Location || event.location) && (
															<div className="flex items-center gap-2">
																<FaMapMarkerAlt className="w-4 h-4 flex-shrink-0" />
																<span className="truncate">
																	{event.parsed?.Location || event.location}
																</span>
															</div>
														)}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						))}

						{/* Load More Button */}
						{hasMore && (
							<div className="flex justify-center pt-4">
								<button
									onClick={loadMore}
									className="inline-flex items-center gap-2 px-6 py-3 backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 hover:bg-white/60 dark:hover:bg-dark-card/60 rounded-full border border-white/20 dark:border-dark-text/10 shadow-lg hover:shadow-xl transition-all duration-300 text-dark-base dark:text-dark-text font-semibold"
								>
									<span>Load More Events</span>
									<FaChevronDown className="w-4 h-4" />
								</button>
							</div>
						)}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center py-16 sm:py-20 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10 shadow-lg">
						<FaCalendarAlt className="w-20 h-20 sm:w-24 sm:h-24 text-dark-base/40 dark:text-dark-text/40 mb-4" />
						<p className="text-xl sm:text-2xl font-semibold text-dark-base dark:text-dark-text mb-2">
							No Upcoming Events
						</p>
						<p className="text-sm sm:text-base text-dark-base/60 dark:text-dark-text/60">
							Check back later for new events
						</p>
					</div>
				)}

				{/* Modal for Enlarged Image */}
				{isModalOpen && (
					<div
						className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-2 sm:p-4"
						onClick={closeModal}
					>
						<div
							className="relative w-full h-full max-w-6xl max-h-full overflow-hidden"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-2 sm:p-4 bg-gradient-to-b from-black/50 to-transparent">
								<button
									onClick={closeModal}
									className="backdrop-blur-sm bg-black/50 hover:bg-red-500/70 text-white p-2.5 sm:p-3 rounded-full transition-all duration-200 hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-5 w-5 sm:h-6 sm:w-6"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>

							<div className="bg-white dark:bg-gray-900 rounded-none sm:rounded-lg lg:rounded-xl overflow-hidden shadow-2xl h-full flex flex-col">
								<div className="relative w-full h-[70vh] bg-black">
									<Image
										src={selectedImage}
										alt="Enlarged Event"
										fill
										className="object-contain"
										sizes="100vw"
										loading="eager"
										priority
										unoptimized
									/>
								</div>

								{selectedImageData && (
									<div className="p-4 sm:p-6 max-h-[30vh] overflow-y-auto">
										{selectedImageData.clubs && (
											<Link
												href={`/club/${selectedImageData.clubs.instagram_handle}`}
												className="inline-flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity"
											>
												{selectedImageData.clubs.instagram_handle && (
													<div className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
														<Image
															src={getClubProfilePic(selectedImageData.clubs.instagram_handle)}
															alt={selectedImageData.clubs.name}
															fill
															className="object-cover"
															sizes="24px"
															unoptimized
															onError={(e) => {
																e.target.style.display = 'none';
															}}
														/>
													</div>
												)}
												<span className="font-semibold text-dark-base dark:text-white">
													{selectedImageData.clubs.name}
												</span>
											</Link>
										)}
										{(selectedImageData.parsed?.Name ||
											selectedImageData.name) && (
											<h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">
												{selectedImageData.parsed?.Name ||
													selectedImageData.name}
											</h3>
										)}
										{(selectedImageData.details ||
											selectedImageData.parsed?.Details) && (
											<p className="text-base text-gray-700 dark:text-gray-300 mb-4">
												{selectedImageData.details ||
													selectedImageData.parsed?.Details}
											</p>
										)}
									</div>
								)}
							</div>
						</div>
					</div>
				)}
			</main>

			<Footer />
		</div>
	);
}
