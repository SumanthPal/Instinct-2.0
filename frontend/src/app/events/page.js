"use client";

import { useState, useEffect } from "react";
import { format, startOfDay, isSameDay, parseISO } from "date-fns";
import { fetchCampusWideEvents } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import { FaCalendarAlt, FaMapMarkerAlt, FaClock, FaChevronDown, FaUserCircle, FaList, FaTh, FaSearch, FaFilter, FaTimes, FaChevronUp } from "react-icons/fa";
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
	const [expandedEventId, setExpandedEventId] = useState(null);
	const [viewMode, setViewMode] = useState("list"); // "list" or "grid"
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedClub, setSelectedClub] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("");
	const [showFilters, setShowFilters] = useState(false);

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
		setVisibleCount(prevCount => prevCount + LOAD_MORE_COUNT);
	};

	const resetFilters = () => {
		setSearchQuery("");
		setSelectedClub("");
		setSelectedCategory("");
	};

	const hasActiveFilters = searchQuery || selectedClub || selectedCategory;

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

	// Infer event category from event details
	const getEventCategory = (event) => {
		const name = (event.parsed?.Name || event.name || "").toLowerCase();
		const details = (event.parsed?.Details || event.details || "").toLowerCase();
		const text = `${name} ${details}`;

		if (text.match(/\b(social|mixer|party|celebration|networking|meet and greet|hangout)\b/i)) return "Social";
		if (text.match(/\b(workshop|seminar|lecture|presentation|talk|symposium|conference)\b/i)) return "Academic";
		if (text.match(/\b(competition|tournament|game|match|sports|athletic)\b/i)) return "Sports";
		if (text.match(/\b(volunteer|service|charity|community|outreach|fundraiser)\b/i)) return "Service";
		if (text.match(/\b(career|recruiting|job|internship|professional|resume)\b/i)) return "Career";
		if (text.match(/\b(culture|cultural|heritage|tradition|festival)\b/i)) return "Cultural";
		if (text.match(/\b(meeting|general body|gbm|board|committee)\b/i)) return "Meeting";
		return "Other";
	};

	// Get unique clubs from all events
	const getUniqueClubs = () => {
		const clubs = allEvents
			.filter(event => event.clubs?.name)
			.map(event => event.clubs.name);
		return [...new Set(clubs)].sort();
	};

	// Filter events based on search and filters
	const getFilteredEvents = () => {
		return allEvents.filter(event => {
			const matchesSearch = searchQuery === "" ||
				(event.parsed?.Name || event.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
				(event.parsed?.Details || event.details || "").toLowerCase().includes(searchQuery.toLowerCase());

			const matchesClub = selectedClub === "" || event.clubs?.name === selectedClub;
			const matchesCategory = selectedCategory === "" || getEventCategory(event) === selectedCategory;

			return matchesSearch && matchesClub && matchesCategory;
		});
	};

	// Toggle event expansion
	const toggleEventExpansion = (eventId) => {
		setExpandedEventId(expandedEventId === eventId ? null : eventId);
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

	const filteredEvents = getFilteredEvents();
	const eventsToShow = filteredEvents.slice(0, visibleCount);
	const groupedEvents = groupEventsByDate(eventsToShow);
	const hasMore = visibleCount < filteredEvents.length;
	const uniqueClubs = getUniqueClubs();
	const categories = ["Social", "Academic", "Sports", "Service", "Career", "Cultural", "Meeting", "Other"];

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
							{filteredEvents.length} of {allEvents.length} events
						</p>
					</div>
				</div>

				{/* Controls: Search, Filters, View Toggle */}
				<div className="mb-6 space-y-4">
					{/* Top row: Search and buttons */}
					<div className="flex flex-col sm:flex-row gap-3">
						{/* Search bar */}
						<div className="flex-1 relative">
							<FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-base/40 dark:text-dark-text/40 w-4 h-4" />
							<input
								type="text"
								placeholder="Search events..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-11 pr-4 py-3 backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 border border-white/20 dark:border-dark-text/10 rounded-xl text-dark-base dark:text-dark-text placeholder-dark-base/40 dark:placeholder-dark-text/40 focus:outline-none focus:ring-2 focus:ring-lavender dark:focus:ring-dark-gradient-start transition-all"
							/>
						</div>

						{/* Filter button */}
						<button
							onClick={() => setShowFilters(!showFilters)}
							className={`px-4 py-3 backdrop-blur-sm border rounded-xl font-semibold transition-all flex items-center gap-2 ${
								showFilters || hasActiveFilters
									? "bg-lavender/30 dark:bg-dark-gradient-start/30 border-lavender dark:border-dark-gradient-start text-dark-base dark:text-dark-text"
									: "bg-white/40 dark:bg-dark-card/40 border-white/20 dark:border-dark-text/10 text-dark-base dark:text-dark-text hover:bg-white/60 dark:hover:bg-dark-card/60"
							}`}
						>
							<FaFilter className="w-4 h-4" />
							<span className="hidden sm:inline">Filters</span>
							{hasActiveFilters && (
								<span className="ml-1 w-2 h-2 rounded-full bg-lavender dark:bg-dark-gradient-start"></span>
							)}
						</button>

						{/* View toggle */}
						<div className="flex backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 border border-white/20 dark:border-dark-text/10 rounded-xl p-1">
							<button
								onClick={() => setViewMode("list")}
								className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
									viewMode === "list"
										? "bg-lavender/30 dark:bg-dark-gradient-start/30 text-dark-base dark:text-dark-text font-semibold"
										: "text-dark-base/60 dark:text-dark-text/60 hover:text-dark-base dark:hover:text-dark-text"
								}`}
							>
								<FaList className="w-4 h-4" />
								<span className="hidden sm:inline">List</span>
							</button>
							<button
								onClick={() => setViewMode("grid")}
								className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
									viewMode === "grid"
										? "bg-lavender/30 dark:bg-dark-gradient-start/30 text-dark-base dark:text-dark-text font-semibold"
										: "text-dark-base/60 dark:text-dark-text/60 hover:text-dark-base dark:hover:text-dark-text"
								}`}
							>
								<FaTh className="w-4 h-4" />
								<span className="hidden sm:inline">Grid</span>
							</button>
						</div>
					</div>

					{/* Filters panel */}
					{showFilters && (
						<div className="backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 border border-white/20 dark:border-dark-text/10 rounded-xl p-4 sm:p-6">
							<div className="flex items-center justify-between mb-4">
								<h3 className="font-semibold text-dark-base dark:text-dark-text">Filter Events</h3>
								{hasActiveFilters && (
									<button
										onClick={resetFilters}
										className="text-sm text-dark-base/60 dark:text-dark-text/60 hover:text-dark-base dark:hover:text-dark-text transition-colors flex items-center gap-1"
									>
										<FaTimes className="w-3 h-3" />
										Clear all
									</button>
								)}
							</div>

							{/* Club filter */}
							<div className="mb-6">
								<label className="block text-sm font-medium text-dark-base dark:text-dark-text mb-3">
									Club
								</label>
								<div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
									<button
										onClick={() => setSelectedClub("")}
										className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
											selectedClub === ""
												? "bg-lavender/30 dark:bg-dark-gradient-start/30 border-lavender dark:border-dark-gradient-start text-dark-base dark:text-dark-text"
												: "bg-white/40 dark:bg-dark-card/40 border-white/20 dark:border-dark-text/10 text-dark-base/60 dark:text-dark-text/60 hover:bg-white/60 dark:hover:bg-dark-card/60"
										}`}
									>
										All Clubs
									</button>
									{uniqueClubs.map(club => {
										const clubEvent = allEvents.find(e => e.clubs?.name === club);
										const clubHandle = clubEvent?.clubs?.instagram_handle;
										const clubProfilePic = clubHandle ? getClubProfilePic(clubHandle) : null;

										return (
											<button
												key={club}
												onClick={() => setSelectedClub(club)}
												className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
													selectedClub === club
														? "bg-lavender/30 dark:bg-dark-gradient-start/30 border-lavender dark:border-dark-gradient-start text-dark-base dark:text-dark-text"
														: "bg-white/40 dark:bg-dark-card/40 border-white/20 dark:border-dark-text/10 text-dark-base/60 dark:text-dark-text/60 hover:bg-white/60 dark:hover:bg-dark-card/60"
												}`}
											>
												{clubProfilePic && (
													<div className="relative w-5 h-5 rounded-full overflow-hidden border border-white/50 dark:border-dark-text/20 flex-shrink-0 bg-gray-200 dark:bg-gray-700">
														<Image
															src={clubProfilePic}
															alt={club}
															fill
															className="object-cover"
															sizes="20px"
															unoptimized
															onError={(e) => {
																e.target.style.display = 'none';
															}}
														/>
													</div>
												)}
												<span className="whitespace-nowrap">{club}</span>
											</button>
										);
									})}
								</div>
							</div>

							{/* Category filter with chips */}
							<div>
								<label className="block text-sm font-medium text-dark-base dark:text-dark-text mb-3">
									Category
								</label>
								<div className="flex flex-wrap gap-2">
									<button
										onClick={() => setSelectedCategory("")}
										className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
											selectedCategory === ""
												? "bg-lavender/30 dark:bg-dark-gradient-start/30 border-lavender dark:border-dark-gradient-start text-dark-base dark:text-dark-text"
												: "bg-white/40 dark:bg-dark-card/40 border-white/20 dark:border-dark-text/10 text-dark-base/60 dark:text-dark-text/60 hover:bg-white/60 dark:hover:bg-dark-card/60"
										}`}
									>
										All
									</button>
									<button
										onClick={() => setSelectedCategory("Social")}
										className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
											selectedCategory === "Social"
												? "bg-pink-500/30 border-pink-500 text-pink-700 dark:text-pink-300"
												: "bg-pink-500/10 border-pink-500/30 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20"
										}`}
									>
										Social
									</button>
									<button
										onClick={() => setSelectedCategory("Academic")}
										className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
											selectedCategory === "Academic"
												? "bg-blue-500/30 border-blue-500 text-blue-700 dark:text-blue-300"
												: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
										}`}
									>
										Academic
									</button>
									<button
										onClick={() => setSelectedCategory("Sports")}
										className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
											selectedCategory === "Sports"
												? "bg-green-500/30 border-green-500 text-green-700 dark:text-green-300"
												: "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/20"
										}`}
									>
										Sports
									</button>
									<button
										onClick={() => setSelectedCategory("Service")}
										className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
											selectedCategory === "Service"
												? "bg-purple-500/30 border-purple-500 text-purple-700 dark:text-purple-300"
												: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
										}`}
									>
										Service
									</button>
									<button
										onClick={() => setSelectedCategory("Career")}
										className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
											selectedCategory === "Career"
												? "bg-orange-500/30 border-orange-500 text-orange-700 dark:text-orange-300"
												: "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20"
										}`}
									>
										Career
									</button>
									<button
										onClick={() => setSelectedCategory("Cultural")}
										className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
											selectedCategory === "Cultural"
												? "bg-yellow-500/30 border-yellow-500 text-yellow-700 dark:text-yellow-300"
												: "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20"
										}`}
									>
										Cultural
									</button>
									<button
										onClick={() => setSelectedCategory("Meeting")}
										className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
											selectedCategory === "Meeting"
												? "bg-gray-500/30 border-gray-500 text-gray-700 dark:text-gray-300"
												: "bg-gray-500/10 border-gray-500/30 text-gray-600 dark:text-gray-400 hover:bg-gray-500/20"
										}`}
									>
										Meeting
									</button>
									<button
										onClick={() => setSelectedCategory("Other")}
										className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
											selectedCategory === "Other"
												? "bg-slate-500/30 border-slate-500 text-slate-700 dark:text-slate-300"
												: "bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20"
										}`}
									>
										Other
									</button>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Events List */}
				{groupedEvents.length > 0 ? (
					<div className="space-y-8 sm:space-y-10">
						{viewMode === "list" ? (
							/* List View - Grouped by Date */
							groupedEvents.map((group, groupIndex) => (
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
											const eventId = `${groupIndex}-${index}`;
											const isExpanded = expandedEventId === eventId;
											const category = getEventCategory(event);
											const categoryColors = {
												Social: "bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30",
												Academic: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
												Sports: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
												Service: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30",
												Career: "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30",
												Cultural: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
												Meeting: "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30",
												Other: "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30"
											};

											return (
												<div
													key={`event-${eventId}`}
													className="group backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/30 dark:border-dark-text/20 overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
												>
													{/* Event Image */}
													{event.image_url && (
														<div
															className="relative w-full h-48 sm:h-56 cursor-pointer overflow-hidden"
															onClick={(e) => {
																e.stopPropagation();
																handleImageClick(event.image_url, event);
															}}
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
															{/* Category badge on image */}
															<div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${categoryColors[category]}`}>
																{category}
															</div>
														</div>
													)}

												<div className="p-4 sm:p-5">
													{/* Club Info and Expand Button */}
													<div className="flex items-center justify-between mb-3">
														{event.clubs && (
															<Link
																href={`/club/${event.clubs.instagram_handle}`}
																onClick={(e) => e.stopPropagation()}
																className="inline-flex items-center gap-2 group/club hover:opacity-80 transition-opacity"
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
														<button
															onClick={() => toggleEventExpansion(eventId)}
															className="ml-auto p-2 rounded-full hover:bg-white/50 dark:hover:bg-dark-card/50 transition-colors"
														>
															{isExpanded ? (
																<FaChevronUp className="w-4 h-4 text-dark-base dark:text-dark-text" />
															) : (
																<FaChevronDown className="w-4 h-4 text-dark-base dark:text-dark-text" />
															)}
														</button>
													</div>

													{/* Event Title */}
													<h4
														className="text-lg sm:text-xl font-bold text-dark-base dark:text-white mb-2 cursor-pointer hover:text-lavender dark:hover:text-dark-gradient-start transition-colors"
														onClick={() => toggleEventExpansion(eventId)}
													>
														{event.parsed?.Name || event.name || "Event"}
													</h4>

													{/* Event Details - Preview */}
													<p className={`text-sm sm:text-base text-dark-base/70 dark:text-dark-text/70 mb-4 transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>
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

													{/* Expanded Content */}
													{isExpanded && (event.parsed?.Location || event.location) && (
														<div className="mt-4 pt-4 border-t border-white/20 dark:border-dark-text/10 animate-in fade-in slide-in-from-top-2 duration-200">
															{/* Location with link */}
															<div>
																<h5 className="text-xs font-semibold text-dark-base/60 dark:text-dark-text/60 uppercase mb-1">Get Directions</h5>
																<a
																	href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.parsed?.Location || event.location)}`}
																	target="_blank"
																	rel="noopener noreferrer"
																	onClick={(e) => e.stopPropagation()}
																	className="text-sm text-lavender dark:text-dark-gradient-start hover:underline flex items-center gap-1"
																>
																	Open in Google Maps
																	<span className="text-xs">↗</span>
																</a>
															</div>
														</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</div>
							))
						) : (
							/* Grid View - All events in one grid */
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
								{eventsToShow.map((event, index) => {
									const clubProfilePic = event.clubs?.instagram_handle
										? getClubProfilePic(event.clubs.instagram_handle)
										: null;
									const eventId = `grid-${index}`;
									const isExpanded = expandedEventId === eventId;
									const category = getEventCategory(event);
									const categoryColors = {
										Social: "bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30",
										Academic: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
										Sports: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
										Service: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30",
										Career: "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30",
										Cultural: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
										Meeting: "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30",
										Other: "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30"
									};
									const eventDate = getEventDate(event);

									return (
										<div
											key={`event-${eventId}`}
											className="group backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/30 dark:border-dark-text/20 overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
										>
											{/* Event Image */}
											{event.image_url && (
												<div
													className="relative w-full h-48 cursor-pointer overflow-hidden"
													onClick={(e) => {
														e.stopPropagation();
														handleImageClick(event.image_url, event);
													}}
												>
													<Image
														src={event.image_url}
														alt="Event Image"
														fill
														className="object-cover group-hover:scale-110 transition-transform duration-300"
														sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
														loading="lazy"
														unoptimized
													/>
													<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
													{/* Category badge on image */}
													<div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${categoryColors[category]}`}>
														{category}
													</div>
													{/* Date badge on image */}
													{eventDate && (
														<div className="absolute top-3 left-3 backdrop-blur-sm bg-white/90 dark:bg-dark-card/90 rounded-lg p-2 border border-white/20 dark:border-dark-text/10">
															<div className="text-center">
																<div className="text-xs font-semibold text-dark-base dark:text-dark-text uppercase">
																	{format(eventDate, "MMM")}
																</div>
																<div className="text-lg font-bold text-dark-base dark:text-dark-text">
																	{format(eventDate, "d")}
																</div>
															</div>
														</div>
													)}
												</div>
											)}

											<div className="p-4">
												{/* Date and Club Row */}
												<div className="flex items-center justify-between mb-3 pb-2 border-b border-white/20 dark:border-dark-text/10">
													{/* Date */}
													{eventDate && (
														<div className="flex items-center gap-2 text-dark-base dark:text-dark-text">
															<FaCalendarAlt className="w-3 h-3" />
															<span className="text-xs font-semibold">
																{format(eventDate, "MMM d, yyyy")}
															</span>
														</div>
													)}

													{/* Expand Button */}
													<button
														onClick={() => toggleEventExpansion(eventId)}
														className="p-1.5 rounded-full hover:bg-white/50 dark:hover:bg-dark-card/50 transition-colors"
													>
														{isExpanded ? (
															<FaChevronUp className="w-3 h-3 text-dark-base dark:text-dark-text" />
														) : (
															<FaChevronDown className="w-3 h-3 text-dark-base dark:text-dark-text" />
														)}
													</button>
												</div>

												{/* Club Info */}
												{event.clubs && (
													<Link
														href={`/club/${event.clubs.instagram_handle}`}
														onClick={(e) => e.stopPropagation()}
														className="inline-flex items-center gap-1.5 mb-2 group/club hover:opacity-80 transition-opacity"
													>
														<div className="relative w-5 h-5 rounded-full overflow-hidden border border-white/50 dark:border-dark-text/20 flex-shrink-0 bg-gray-200 dark:bg-gray-700">
															{clubProfilePic ? (
																<Image
																	src={clubProfilePic}
																	alt={event.clubs.name}
																	fill
																	className="object-cover"
																	sizes="20px"
																	unoptimized
																	onError={(e) => {
																		e.target.style.display = 'none';
																		e.target.nextSibling.style.display = 'flex';
																	}}
																/>
															) : null}
															<div className="absolute inset-0 flex items-center justify-center" style={{ display: clubProfilePic ? 'none' : 'flex' }}>
																<FaUserCircle className="w-4 h-4 text-gray-400" />
															</div>
														</div>
														<span className="text-xs font-medium text-dark-base dark:text-dark-text group-hover/club:underline line-clamp-1">
															{event.clubs.name}
														</span>
													</Link>
												)}

												{/* Event Title */}
												<h4
													className="text-base font-bold text-dark-base dark:text-white mb-2 cursor-pointer hover:text-lavender dark:hover:text-dark-gradient-start transition-colors"
													onClick={() => toggleEventExpansion(eventId)}
												>
													{event.parsed?.Name || event.name || "Event"}
												</h4>

												{/* Event Details - Preview/Full */}
												{(event.parsed?.Details || event.details) && (
													<p className={`text-xs text-dark-base/70 dark:text-dark-text/70 mb-3 transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>
														{event.parsed?.Details || event.details}
													</p>
												)}

												{/* Event Meta Info */}
												<div className="space-y-1 text-xs text-dark-base/60 dark:text-dark-text/60">
													{/* Time */}
													<div className="flex items-center gap-2">
														<FaClock className="w-3 h-3 flex-shrink-0" />
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
															<FaMapMarkerAlt className="w-3 h-3 flex-shrink-0" />
															<span className="truncate">
																{event.parsed?.Location || event.location}
															</span>
														</div>
													)}
												</div>

												{/* Expanded Content */}
												{isExpanded && (event.parsed?.Location || event.location) && (
													<div className="mt-3 pt-3 border-t border-white/20 dark:border-dark-text/10 animate-in fade-in slide-in-from-top-2 duration-200">
														{/* Location with link */}
														<div>
															<h5 className="text-xs font-semibold text-dark-base/60 dark:text-dark-text/60 uppercase mb-1">Get Directions</h5>
															<a
																href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.parsed?.Location || event.location)}`}
																target="_blank"
																rel="noopener noreferrer"
																onClick={(e) => e.stopPropagation()}
																className="text-xs text-lavender dark:text-dark-gradient-start hover:underline flex items-center gap-1"
															>
																Open in Google Maps
																<span className="text-xs">↗</span>
															</a>
														</div>
													</div>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}

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
