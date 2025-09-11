// app/news/page.js
"use client";
import React, { useState, useEffect } from "react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import RssFeed from "@/components/RssFeed";
import Link from "next/link";

// RSS feed URLs for different categories and schools
const RSS_FEEDS = {
	categories: {
		"All Headlines": "https://news.uci.edu/feed/",
		"Arts & Humanities":
			"https://news.uci.edu/category/art-and-humanities/feed/",
		Athletics: "https://news.uci.edu/category/athletics/feed/",
		"Campus Life": "https://news.uci.edu/category/campus-life/feed/",
		Health: "https://news.uci.edu/category/health/feed/",
		"Science & Technology":
			"https://news.uci.edu/category/science-and-tech/feed/",
		"Society & Community":
			"https://news.uci.edu/category/society-and-community/feed/",
	},
	schools: {
		Arts: "https://news.uci.edu/category/arts/feed/",
		"Biological Sciences":
			"https://news.uci.edu/category/biological-sciences/feed/",
		Business: "https://news.uci.edu/category/business/feed/",
		Education: "https://news.uci.edu/category/education/feed/",
		Engineering: "https://news.uci.edu/category/engineering/feed/",
		"Health Sciences": "https://news.uci.edu/category/health-sciences/feed/",
		Humanities: "https://news.uci.edu/category/humanities/feed/",
		"Information & Computer Sciences":
			"https://news.uci.edu/category/ics/feed/",
		Law: "https://news.uci.edu/category/law/feed/",
		Medicine: "https://news.uci.edu/category/medicine/feed/",
		"Physical Sciences":
			"https://news.uci.edu/category/physical-sciences/feed/",
		"Social Ecology": "https://news.uci.edu/category/social-ecology/feed/",
		"Social Sciences": "https://news.uci.edu/category/social-sciences/feed/",
	},
};

// Array of featured trending categories
const TRENDING_CATEGORIES = [
	"Campus Life",
	"Athletics",
	"Science & Technology",
];

export default function NewsPage() {
	const [activeTab, setActiveTab] = useState("categories");
	const [selectedCategory, setSelectedCategory] = useState("All Headlines");
	const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'

	// Function to handle changing the feed category/school
	const handleFeedChange = (category) => {
		setSelectedCategory(category);
	};

	// Get the current feed URL based on active tab and selected category
	const currentFeedUrl = RSS_FEEDS[activeTab][selectedCategory];

	// Emoji mapping for categories
	const categoryEmojis = {
		"All Headlines": "📰",
		"Arts & Humanities": "🎨",
		Athletics: "🏀",
		"Campus Life": "🏫",
		Health: "🩺",
		"Science & Technology": "🔬",
		"Society & Community": "👥",
		Arts: "🎭",
		"Biological Sciences": "🧬",
		Business: "💼",
		Education: "🎓",
		Engineering: "⚙",
		"Health Sciences": "💊",
		Humanities: "📚",
		"Information & Computer Sciences": "💻",
		Law: "⚖",
		Medicine: "🏥",
		"Physical Sciences": "⚛",
		"Social Ecology": "🌱",
		"Social Sciences": "🧠",
	};

	return (
		<div className="min-h-screen overflow-hidden bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
			<Navbar />

			<main className="container mx-auto px-3 sm:px-4 pt-[100px] sm:pt-[120px] pb-10 sm:pb-16 md:pb-20 text-center">
				{/* Heading */}
				<div className="mb-12">
					<h1 className="text-5xl font-bold mb-3 text-dark-base dark:text-white">
						UCI News & Updates
					</h1>
					<p className="text-dark-base dark:text-dark-subtext text-lg">
						Stay in the loop with what's happening at UCI
					</p>
				</div>

				{/* View Toggle */}
				<div className="flex justify-end mb-6">
					<div className="inline-flex backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-lg p-1 border border-white/20 dark:border-dark-text/10">
						<button
							onClick={() => setViewMode("grid")}
							className={`p-2 rounded ${viewMode === "grid" ? "bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white" : "text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10"}`}
							aria-label="Grid view"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
								/>
							</svg>
						</button>
						<button
							onClick={() => setViewMode("list")}
							className={`p-2 rounded ${viewMode === "list" ? "bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white" : "text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10"}`}
							aria-label="List view"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 6h16M4 12h16M4 18h16"
								/>
							</svg>
						</button>
					</div>
				</div>

				{/* Glass Tabs */}
				<div className="inline-flex mb-8 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 p-1 rounded-full border border-white/20 dark:border-dark-text/10 shadow-md">
					{["categories", "schools"].map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab)}
							className={`px-6 py-3 rounded-full text-lg font-medium transition-all ${
								activeTab === tab
									? "bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md"
									: "text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10"
							}`}
						>
							{tab.charAt(0).toUpperCase() + tab.slice(1)}
						</button>
					))}
				</div>

				{/* Subcategory Pills with Emojis */}
				<div className="flex flex-wrap justify-center gap-2 mb-12 max-w-4xl mx-auto">
					{Object.keys(RSS_FEEDS[activeTab]).map((category) => (
						<button
							key={category}
							onClick={() => handleFeedChange(category)}
							className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
								category === selectedCategory
									? "bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md"
									: "bg-white/30 dark:bg-dark-card/30 text-dark-base dark:text-dark-text hover:bg-white/50 dark:hover:bg-dark-card/50"
							}`}
						>
							<span className="mr-1">{categoryEmojis[category] || "📄"}</span>{" "}
							{category}
						</button>
					))}
				</div>

				{/* Main Feed */}
				<section className="mb-20">
					<div className="flex items-center justify-center mb-8">
						<div className="h-px bg-gradient-to-r from-transparent via-lavender dark:via-dark-gradient-start to-transparent w-16 mr-4"></div>
						<h2 className="text-3xl font-bold text-dark-base dark:text-white flex items-center">
							<span className="mr-2">
								{categoryEmojis[selectedCategory] || "📄"}
							</span>
							{selectedCategory}
						</h2>
						<div className="h-px bg-gradient-to-r from-lavender dark:from-dark-gradient-start via-sky-blue dark:via-dark-gradient-end to-transparent w-16 ml-4"></div>
					</div>

					<RssFeed
						feedUrl={currentFeedUrl}
						className={`mx-auto ${viewMode === "grid" ? "max-w-6xl" : "max-w-3xl"}`}
						maxItems={viewMode === "grid" ? 9 : 5}
						showFullContent={viewMode === "list"}
						viewMode={viewMode}
					/>
				</section>
			</main>

			<Footer />

			{/* Add custom CSS for animations */}
			<style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
		</div>
	);
}

