"use client";

import React, { useState, useEffect } from "react";
import "../../../styles/globals.css";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import {
	FaBook,
	FaCalendar,
	FaDoorOpen,
	FaSpinner,
	FaChevronDown,
} from "react-icons/fa";

const Resources = () => {
	const [libraryTraffic, setLibraryTraffic] = useState([]);
	const [weekData, setWeekData] = useState(null);
	const [calendarData, setCalendarData] = useState(null);
	const [studyRooms, setStudyRooms] = useState([]);
	const [expandedLibrary, setExpandedLibrary] = useState(null);
	const [loading, setLoading] = useState({
		library: true,
		calendar: true,
		studyRooms: true,
	});
	const [errors, setErrors] = useState({
		library: null,
		calendar: null,
		studyRooms: null,
	});

	useEffect(() => {
		fetchLibraryTraffic();
		fetchCalendar();
		fetchStudyRooms();
	}, []);

	const fetchLibraryTraffic = async () => {
		try {
			const response = await fetch(
				"https://anteaterapi.com/v2/rest/libraryTraffic"
			);
			const data = await response.json();
			if (data.ok) {
				setLibraryTraffic(data.data);
			}
		} catch (error) {
			console.error("Error fetching library traffic:", error);
			setErrors((prev) => ({ ...prev, library: "Failed to load data" }));
		} finally {
			setLoading((prev) => ({ ...prev, library: false }));
		}
	};

	const fetchCalendar = async () => {
		try {
			// Fetch both calendar and week data
			const [calendarRes, weekRes] = await Promise.all([
				fetch("https://anteaterapi.com/v2/rest/calendar"),
				fetch("https://anteaterapi.com/v2/rest/week"),
			]);

			const calendarData = await calendarRes.json();
			const weekData = await weekRes.json();

			if (calendarData.ok) {
				setCalendarData(calendarData.data);
			}
			if (weekData.ok) {
				setWeekData(weekData.data);
			}
		} catch (error) {
			console.error("Error fetching calendar:", error);
			setErrors((prev) => ({ ...prev, calendar: "Failed to load data" }));
		} finally {
			setLoading((prev) => ({ ...prev, calendar: false }));
		}
	};

	const fetchStudyRooms = async () => {
		try {
			const response = await fetch(
				"https://anteaterapi.com/v2/rest/studyRooms"
			);
			const data = await response.json();
			if (data.ok) {
				setStudyRooms(data.data);
			}
		} catch (error) {
			console.error("Error fetching study rooms:", error);
			setErrors((prev) => ({ ...prev, studyRooms: "Failed to load data" }));
		} finally {
			setLoading((prev) => ({ ...prev, studyRooms: false }));
		}
	};

	const getLibraryImage = (libraryName) => {
		const imageMap = {
			"Langson Library": "/langson.jpg",
			"Science Library": "/science.jpg",
			"Gateway Study Center": "/gateway.jpg",
		};
		return imageMap[libraryName] || "/langson.jpg";
	};

	const groupLibrariesByName = () => {
		const libraries = {
			"Langson Library": [],
			"Science Library": [],
			"Gateway Study Center": [],
		};

		libraryTraffic.forEach((location) => {
			if (libraries[location.libraryName]) {
				libraries[location.libraryName].push(location);
			}
		});

		return libraries;
	};

	const getAverageTraffic = (locations) => {
		if (locations.length === 0) return 0;
		const total = locations.reduce(
			(sum, loc) => sum + loc.trafficPercentage,
			0
		);
		return total / locations.length;
	};

	const getTrafficColor = (percentage) => {
		if (percentage < 0.3) return "text-green-600 dark:text-green-400";
		if (percentage < 0.7) return "text-yellow-600 dark:text-yellow-400";
		return "text-red-600 dark:text-red-400";
	};

	const getTrafficLabel = (percentage) => {
		if (percentage < 0.3) return "Not Busy";
		if (percentage < 0.7) return "Moderate";
		return "Very Busy";
	};

	const formatDate = (dateString) => {
		if (!dateString) return "N/A";
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const groupedLibraries = groupLibrariesByName();

	return (
		<div className="flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
			<Navbar />

			<main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-[112px] sm:px-6 sm:pt-[120px]">
				{/* Hero Section */}
				<section className="mb-12">
					<h1 className="instinct-heading text-3xl font-semibold tracking-tight text-foreground">
						Student Resources
					</h1>
					<p className="mt-3 text-sm text-muted-foreground">
						Real-time campus utilities to help you navigate UCI
					</p>
				</section>

				{/* Library Traffic */}
				<section className="mb-12 sm:mb-16">
					<div className="flex items-center mb-6">
						<FaBook className="mr-3 text-xl text-[color:var(--accent-brand)]" />
						<h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Library Traffic
						</h2>
					</div>

					{loading.library ? (
						<div className="flex justify-center items-center py-12 rounded-xl border border-border bg-card">
							<FaSpinner className="animate-spin text-3xl text-muted-foreground motion-reduce:animate-none" />
						</div>
					) : errors.library ? (
						<div className="rounded-xl border border-border bg-card p-6 text-center">
							<p className="text-muted-foreground">
								{errors.library}
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{Object.entries(groupedLibraries).map(
								([libraryName, locations]) => {
									const avgTraffic = getAverageTraffic(locations);
									const isExpanded = expandedLibrary === libraryName;
									return (
										<div
											key={libraryName}
											className="overflow-hidden rounded-xl border border-border bg-card"
										>
											{/* Library Header - Clickable */}
											<button
												onClick={() =>
													setExpandedLibrary(isExpanded ? null : libraryName)
												}
												className="w-full"
											>
												<div className="relative">
													{/* Library Image */}
													<div className="h-64 sm:h-80 relative overflow-hidden">
														<img
															src={getLibraryImage(libraryName)}
															alt={libraryName}
															className="w-full h-full object-cover"
														/>
														{/* Dark overlay for better text readability */}
														<div className="absolute inset-0 bg-black/20" />
														{/* Status Badge */}
														<div className="absolute top-4 right-4 rounded-full bg-black/60 px-4 py-2">
															<span
																className={`font-bold ${getTrafficColor(
																	avgTraffic
																)}`}
															>
																{getTrafficLabel(avgTraffic)}
															</span>
														</div>
														{/* Library Name Overlay */}
														<div className="absolute bottom-0 left-0 right-0 bg-black/55 p-6">
															<div className="flex items-center justify-between">
																<h3 className="text-2xl font-semibold text-white sm:text-3xl">
																	{libraryName}
																</h3>
																<FaChevronDown
																	className={`text-white text-xl transition-transform duration-300 ${
																		isExpanded ? "rotate-180" : ""
																	}`}
																/>
															</div>
															{locations.length > 0 && (
																<p className="text-white/90 text-sm mt-1">
																	{locations.length} location
																	{locations.length !== 1 ? "s" : ""} tracked
																</p>
															)}
														</div>
													</div>
												</div>
											</button>

											{/* Collapsible Content */}
											<div
												className={`transition-all duration-300 overflow-hidden ${
													isExpanded ? "max-h-[1000px]" : "max-h-0"
												}`}
											>
												<div className="p-6">
													{locations.length > 0 ? (
														<div className="space-y-3">
															{locations.map((location) => (
																<div
																	key={location.id}
																	className="flex items-center justify-between rounded-lg border border-border p-4"
																>
																	<div className="flex-1">
																		<p className="text-base font-medium text-foreground">
																			{location.locationName}
																		</p>
																		<p className="text-sm text-muted-foreground mt-1">
																			{location.trafficCount} people
																		</p>
																	</div>
																	<div className="text-right">
																		<span
																			className={`text-2xl font-bold ${getTrafficColor(
																				location.trafficPercentage
																			)}`}
																		>
																			{Math.round(
																				location.trafficPercentage * 100
																			)}
																			%
																		</span>
																		<p className="text-xs text-muted-foreground mt-1">
																			capacity
																		</p>
																	</div>
																</div>
															))}
														</div>
													) : (
														<p className="text-muted-foreground text-center py-4">
															No data available
														</p>
													)}
												</div>
											</div>
										</div>
									);
								}
							)}
						</div>
					)}
				</section>

				{/* Academic Calendar */}
				<section className="mb-12 sm:mb-16">
					<div className="flex items-center mb-6">
						<FaCalendar className="mr-3 text-xl text-[color:var(--accent-brand)]" />
						<h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Academic Calendar
						</h2>
					</div>

					{loading.calendar ? (
						<div className="flex justify-center items-center py-12 rounded-xl border border-border bg-card">
							<FaSpinner className="animate-spin text-3xl text-muted-foreground motion-reduce:animate-none" />
						</div>
					) : errors.calendar ? (
						<div className="rounded-xl border border-border bg-card p-6 text-center">
							<p className="text-muted-foreground">
								{errors.calendar}
							</p>
						</div>
					) : calendarData ? (
						<div className="rounded-xl border border-border bg-card p-6">
							<div className="mb-6">
								<h3 className="mb-2 text-lg font-semibold text-foreground">
									{calendarData.quarter || "Current Quarter"}
								</h3>
								{weekData && (
									<p className="text-sm text-muted-foreground mb-2">
										Week {weekData.weeks} of {weekData.quarters}
									</p>
								)}
								{calendarData.startDate && calendarData.endDate && (
									<p className="text-muted-foreground">
										{formatDate(calendarData.startDate)} -{" "}
										{formatDate(calendarData.endDate)}
									</p>
								)}
							</div>

							<div className="space-y-3">
								{calendarData.instructionStart && (
									<div className="flex justify-between items-center py-2 border-b border-border">
										<span className="text-muted-foreground">
											Instruction Starts
										</span>
										<span className="font-medium text-foreground">
											{formatDate(calendarData.instructionStart)}
										</span>
									</div>
								)}
								{calendarData.instructionEnd && (
									<div className="flex justify-between items-center py-2 border-b border-border">
										<span className="text-muted-foreground">
											Instruction Ends
										</span>
										<span className="font-medium text-foreground">
											{formatDate(calendarData.instructionEnd)}
										</span>
									</div>
								)}
								{calendarData.finalsStart && (
									<div className="flex justify-between items-center py-2 border-b border-border">
										<span className="text-muted-foreground">
											Finals Start
										</span>
										<span className="font-medium text-foreground">
											{formatDate(calendarData.finalsStart)}
										</span>
									</div>
								)}
								{calendarData.finalsEnd && (
									<div className="flex justify-between items-center py-2">
										<span className="text-muted-foreground">
											Finals End
										</span>
										<span className="font-medium text-foreground">
											{formatDate(calendarData.finalsEnd)}
										</span>
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="rounded-xl border border-border bg-card p-6 text-center">
							<p className="text-muted-foreground">
								No calendar data available
							</p>
						</div>
					)}
				</section>

				{/* Study Rooms */}
				<section className="mb-12 sm:mb-16">
					<div className="flex items-center mb-6">
						<FaDoorOpen className="mr-3 text-xl text-[color:var(--accent-brand)]" />
						<h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Study Rooms
						</h2>
					</div>

					{loading.studyRooms ? (
						<div className="flex justify-center items-center py-12 rounded-xl border border-border bg-card">
							<FaSpinner className="animate-spin text-3xl text-muted-foreground motion-reduce:animate-none" />
						</div>
					) : errors.studyRooms ? (
						<div className="rounded-xl border border-border bg-card p-6 text-center">
							<p className="text-muted-foreground">
								{errors.studyRooms}
							</p>
						</div>
					) : (
						<div className="rounded-xl border border-border bg-card p-6">
							<div className="space-y-4">
								{studyRooms.slice(0, 10).map((room) => (
									<div
										key={room.id}
										className="rounded-lg border border-border p-4"
									>
										<div className="flex justify-between items-start">
											<div>
												<h3 className="font-semibold text-foreground">
													{room.name}
												</h3>
												{room.description && (
													<p className="text-sm text-muted-foreground mt-1">
														{room.description}
													</p>
												)}
												{room.capacity && (
													<p className="text-sm text-muted-foreground mt-1">
														Capacity: {room.capacity} people
													</p>
												)}
											</div>
										</div>
									</div>
								))}
							</div>
							<div className="mt-4 text-center">
								<a
									href="https://spaces.lib.uci.edu/"
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-foreground underline-offset-4 hover:underline"
								>
									View all rooms & book on UCI Libraries →
								</a>
							</div>
						</div>
					)}
				</section>
			</main>

			<Footer />
		</div>
	);
};

export default Resources;
