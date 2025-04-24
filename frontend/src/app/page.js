// Landing Page for Instinct - Fullscreen with Larger Cards and Tilt Effect
"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "../components/ui/Navbar";
import Footer from "../components/ui/Footer";
import TypingAnimation from "../components/ui/TypingAnimation";

// Smooth Crossfade UCI Background Component
const UCIBackground = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [nextImageIndex, setNextImageIndex] = useState(1);
  const [fadeState, setFadeState] = useState("current"); // "current", "fading", "next"
  
  // Updated image paths
  const uciImages = [
    "campus_1.jpg",
    "campus_2.jpg",
    "campus_3.jpg",
    "campus_4.jpg",
    "campus_5.jpg",
    "campus_6.jpg",
  ];

  // Crossfade between images to prevent white flash
  useEffect(() => {
    const interval = setInterval(() => {
      // Start fade transition
      setFadeState("fading");
      
      // After fade completes, switch to next image
      setTimeout(() => {
        setCurrentImageIndex(nextImageIndex);
        setNextImageIndex((nextImageIndex + 1) % uciImages.length);
        setFadeState("current");
      }, 1000);
    }, 6000);
    
    return () => clearInterval(interval);
  }, [nextImageIndex]);

  return (
    <div className="fixed inset-0 overflow-hidden -z-10">
      {/* Current image */}
      <div 
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
          fadeState === "fading" ? "opacity-0" : "opacity-100"
        }`}
        style={{ 
          backgroundImage: `url(${uciImages[currentImageIndex]})`,
        }}
      />
      
      {/* Next image - preloaded and ready */}
      <div 
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
          fadeState === "fading" ? "opacity-100" : "opacity-0"
        }`}
        style={{ 
          backgroundImage: `url(${uciImages[nextImageIndex]})`,
          filter: 'blur(3px)',
        }}
      />
      
      {/* White overlay for readability - remains constant during transitions */}
      <div className="absolute inset-0 bg-white opacity-60" />
    </div>
  );
};

// Tilt Card Component
const TiltCard = ({ children, className }) => {
  const cardRef = useRef(null);
  const [tiltStyle, setTiltStyle] = useState({});

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    
    // Calculate mouse position relative to card center
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate rotation values (max 10 degrees)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / centerY * -5; // Invert Y-axis
    const rotateY = (x - centerX) / centerX * 5;
    
    // Update transform style
    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`,
      transition: 'transform 0.05s linear',
    });
  };

  const handleMouseLeave = () => {
    // Reset transform when mouse leaves
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)',
      transition: 'transform 0.3s ease-out',
    });
  };

  return (
    <div
      ref={cardRef}
      className={`${className} overflow-hidden`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={tiltStyle}
    >
      {children}
    </div>
  );
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden text-gray-900 dark:text-dark-text">
      {/* UCI Background with crossfade effect */}
      <UCIBackground />

      {/* Compact Navbar */}
      <Navbar />

      {/* Main Content - Fullscreen with larger cards */}
      <div className="flex-1 flex flex-col md:flex-row p-4 md:p-6 gap-4 md:gap-6 max-w-7xl mx-auto mt-10">
        {/* Left Column: Hero (larger) */}
        <div className="w-full md:w-1/2 flex flex-col">
          <TiltCard className="flex-1 bg-white/20 dark:bg-dark-card/20 p-6 md:p-8 rounded-xl backdrop-blur-none flex flex-col justify-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-clip-text bg-gradient-to-r from-sky-blue to-lavender dark:from-dark-text-white dark:to-dark-text">
              Discover Your UCI Community
            </h1>
            <div className="h-8 md:h-10 mb-4">
              <TypingAnimation 
                text={["Find your people.", "Join your passion.", "Fuel your curiosity."]} 
                className="text-xl md:text-2xl font-medium text-gray-800 dark:text-dark-text-white"
              />
            </div>
            <p className="text-base md:text-xl text-gray-700 mb-12 font-bold">
              Instinct connects UC Irvine students to over 600+ clubs with real-time insights, 
              Instagram activity, and powerful search filters.
            </p>
            <a href="/clubs" className="mt-auto">
              <button className="w-full md:w-auto px-6 py-3 text-lg font-semibold bg-lavender hover:bg-sky-blue text-gray-900 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                Browse Clubs
              </button>
            </a>
          </TiltCard>
        </div>
        
        {/* Right Column: Features & About */}
        <div className="w-full md:w-1/2 flex flex-col gap-4 md:gap-6">
          {/* About Section - Larger */}
          <TiltCard className="bg-gradient-to-r from-pastel-pink/20 to-sky-blue/20 dark:bg-dark-profile-card/20 p-6 md:p-8 rounded-xl shadow-md flex-1">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">What is Instinct?</h2>
            <p className="text-base md:text-lg text-gray-800">
              Your gateway to discovering campus life at UC Irvine. From cultural groups 
              to pre-professional organizations, Instinct lets you filter, explore, and connect—all in one place.
              Created by Anteaters, for Anteaters.
            </p>
          </TiltCard>
          
          {/* Features Grid - Larger cards with tilt effect */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 flex-1">
            {/* Feature Card 1 */}
            <TiltCard className="bg-white/20 dark:bg-dark-profile-card/20 p-5 md:p-6 rounded-xl shadow-md">
              <div className="text-3xl md:text-4xl mb-3">🔍</div>
              <h3 className="text-xl md:text-2xl font-bold mb-2">Discover</h3>
              <p className="text-sm md:text-base text-gray-700">
                Browse a curated directory of active UCI clubs with live updates and Instagram feeds.
              </p>
            </TiltCard>
            
            {/* Feature Card 2 */}
            <TiltCard className="bg-white/20 dark:bg-dark-profile-card/20 p-5 md:p-6 rounded-xl shadow-md">
              <div className="text-3xl md:text-4xl mb-3">🎯</div>
              <h3 className="text-xl md:text-2xl font-bold mb-2">Filter</h3>
              <p className="text-sm md:text-base text-gray-700">
                Find exactly what you're looking for with powerful search and category filters.
              </p>
            </TiltCard>
            
            {/* Feature Card 3 */}
            <TiltCard className="bg-white/20 dark:bg-dark-profile-card/20 p-5 md:p-6 rounded-xl shadow-md">
              <div className="text-3xl md:text-4xl mb-3">🔗</div>
              <h3 className="text-xl md:text-2xl font-bold mb-2">Connect</h3>
              <p className="text-sm md:text-base text-gray-700">
                Subscribe to never miss out on any club events.
              </p>
            </TiltCard>
          </div>
          
          {/* CTA Section - Larger */}
          <TiltCard className="bg-gradient-to-r from-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end p-6 md:p-8 rounded-xl shadow-md text-center flex-1">
            <h3 className="text-xl md:text-2xl font-bold mb-2 text-gray-900 dark:text-dark-text-white">Ready to Dive In?</h3>
            <p className="text-base md:text-lg mb-4 text-gray-800 dark:text-dark-text-white">
              Join over 15,000 UCI students already using Instinct
            </p>
            <a href="/clubs">
              <button className="px-8 py-3 text-lg font-bold bg-white hover:bg-white/90 text-gray-900 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                Get Started Now
              </button>
            </a>
          </TiltCard>
        </div>
      </div>

      {/* Slim Footer */}
      <Footer />
    </div>
  );
}