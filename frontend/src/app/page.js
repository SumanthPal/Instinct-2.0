// Landing Page for Instinct - Fullscreen with Larger Cards and Tilt Effect
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Navbar from "../components/ui/Navbar";
import Footer from "../components/ui/Footer";
import TypingAnimation from "../components/ui/TypingAnimation";

const InstinctBackground = () => {
	return (
		<div className="fixed inset-0 overflow-hidden z-5">
			{/* Gradient background */}
			<div className="absolute inset-0 bg-gradient-to-br from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end"></div>

			{/* Logo */}
			<div className="absolute inset-0 flex items-center justify-center opacity-30">
				<Image
					src="/logo.svg"
					alt="Instinct Logo"
					width={1600}
					height={1600}
					priority
					className="object-contain max-w-6xl"
				/>
			</div>

			{/* Overlay for readability */}
			<div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
		</div>
	);
};

export default function Home() {
	return (
		<div className="min-h-screen flex flex-col justify-between items-center text-gray-900 dark:text-dark-text relative overflow-hidden">
			<InstinctBackground />
			<Navbar />

			{/* Hero Section */}
			<div className="flex flex-col items-center justify-center text-center flex-1 px-6 pt-24 sm:pt-32 pb-24 sm:pb-32 z-10">
				<h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700 dark:from-dark-text-white dark:to-dark-subtext mb-8 drop-shadow-lg">
					Instinct at UC Irvine
				</h1>
				<TypingAnimation
					text={[
						"Find your people.",
						"Join your passion.",
						"Fuel your curiosity.",
					]}
					className="text-3xl md:text-4xl lg:text-5xl font-semibold text-gray-900 dark:text-white mb-12 drop-shadow-lg dark:drop-shadow-[0_4px_8px_rgba(255,255,255,0.3)]"
				/>
				<div className="flex flex-col md:flex-row gap-6">
					<a href="/clubs">
						<button className="px-14 py-6 text-xl md:text-2xl font-bold bg-white/40 backdrop-blur-md dark:bg-dark-profile-card/40 rounded-2xl shadow-xl hover:scale-105 hover:bg-white/60 dark:hover:bg-dark-profile-card/60 transition-all duration-300">
							Explore Clubs
						</button>
					</a>
					<a href="/events">
						<button className="px-14 py-6 text-xl md:text-2xl font-bold bg-white/40 backdrop-blur-md dark:bg-dark-profile-card/40 rounded-2xl shadow-xl hover:scale-105 hover:bg-white/60 dark:hover:bg-dark-profile-card/60 transition-all duration-300">
							Explore Events
						</button>
					</a>
				</div>
			</div>

			<Footer />
		</div>
	);
}

