// Landing Page for Instinct - Fullscreen with Larger Cards and Tilt Effect
"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "../components/ui/Navbar";
import Footer from "../components/ui/Footer";
import TypingAnimation from "../components/ui/TypingAnimation";
import { useToast } from '@/components/ui/toast';
import { useSearchParams, useRouter } from 'next/navigation';

// Error Handler Component 
const ErrorHandler = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const hasProcessedError = useRef(false);
  
  useEffect(() => {
    // Only run this once when the component mounts
    if (hasProcessedError.current) return;
    
    const error = searchParams.get('error');
    if (!error) return;
    
    // Mark locally to avoid re-processing in this component
    hasProcessedError.current = true;
    
    // Remove error from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url);
    }
    
    // Show relevant toast
    if (error === 'invalid-email') {
      toast({
        title: 'Invalid Email',
        description: 'Please sign in with your UCI email address.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  }, []); // Empty dependency array means this runs once on mount
  
  return null;
};

const UCIBackground = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [prevImageIndex, setPrevImageIndex] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  
  const uciImages = [
    "campus_1.jpeg",
    "campus_2.jpeg",
    "campus_3.jpeg",
    "campus_4.jpeg",
    "campus_5.jpeg",
    "campus_6.jpeg",
  ];
  
  // Preload images for smoother transitions
  useEffect(() => {
    uciImages.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const startSlideshow = () => {
      // Clear any existing interval/timeout
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      
      intervalRef.current = setInterval(() => {
        // Save current as previous
        setPrevImageIndex(currentImageIndex);
        
        // Set next image
        const nextIndex = (currentImageIndex + 1) % uciImages.length;
        setCurrentImageIndex(nextIndex);
        
        // Start transition
        setIsTransitioning(true);
        
        // Reset transition state after animation completes
        timerRef.current = setTimeout(() => {
          setIsTransitioning(false);
        }, 1000);
      }, 6000);
    };
    
    startSlideshow();
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentImageIndex, uciImages.length]);

  return (
    <div className="fixed inset-0 overflow-hidden z-5">
      {/* Background images */}
      <div className="absolute inset-0">
        {/* Current image (always visible) */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${uciImages[currentImageIndex]})`,
            opacity: isTransitioning ? 0 : 1,
            transition: "opacity 1000ms ease-in-out"
          }}
        />
        
        {/* Previous image (fading out) */}
        {prevImageIndex !== null && (
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${uciImages[prevImageIndex]})`,
              opacity: isTransitioning ? 1 : 0,
              transition: "opacity 1000ms ease-in-out"
            }}
          />
        )}
      </div>
      
      {/* White overlay for readability */}
      <div className="absolute inset-0 bg-white opacity-40" />
    </div>
  );
};

export default function Home() {
  return (
<div className="min-h-screen flex flex-col justify-between items-center text-gray-900 dark:text-dark-text relative overflow-hidden">
<ErrorHandler />
      <UCIBackground />
      <Navbar />

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center text-center flex-1 px-6 pt-24 sm:pt-32 pb-24 sm:pb-32 z-10">
      <h1 className="text-8xl md:text-7xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-sky-blue to-lavender dark:from-dark-text-white dark:to-dark-subtext mb-8 drop-shadow-lg">
          Instinct at UC Irvine
        </h1>

        <TypingAnimation
          text={["Find your people.", "Join your passion.", "Fuel your curiosity."]}
          className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-dark-text-white mb-12"
        />

        <div className="flex flex-col md:flex-row gap-6">
          <a href="/clubs">
            <button className="px-12 py-5 text-lg font-bold bg-white/40 backdrop-blur-md dark:bg-dark-profile-card/40 rounded-2xl shadow-xl hover:scale-105 hover:bg-white/60 dark:hover:bg-dark-profile-card/60 transition-all duration-300">
              Explore Clubs
            </button>
          </a>
        </div>
      </div>

      <Footer />
    </div>
  );
}