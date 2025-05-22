'use client';

import { useEffect, useState, useRef, useMemo, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardHeader, CardContent, CardFooter } from './ui/Card';
import { FaUserCircle } from 'react-icons/fa';
import { FaStar, FaRegStar } from 'react-icons/fa';
import { useAuth } from '@/context/auth-context';
import { likesService } from '@/lib/like-service';
import { useToast } from './ui/toast';
import { VscVerifiedFilled } from "react-icons/vsc";

// Color cache to prevent re-calculating colors for the same clubs
const colorCache = new Map();

// Pre-generate colors synchronously to prevent flickering
const generateColorFromText = (text) => {
  if (!text) return 'rgba(103, 86, 204, 1)';
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Ensure colors are vibrant and readable
  const r = Math.abs((hash & 0xFF0000) >> 16) % 180 + 75; // 75-255 range
  const g = Math.abs((hash & 0x00FF00) >> 8) % 180 + 75;
  const b = Math.abs(hash & 0x0000FF) % 180 + 75;
  
  return `rgb(${r}, ${g}, ${b})`;
};

const createGradientColors = (baseColorRGB) => {
  const match = baseColorRGB.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return {
    light: 'rgba(103, 86, 204, 0.15)',
    medium: 'rgba(103, 86, 204, 0.3)',
    dark: 'rgba(103, 86, 204, 0.5)'
  };
  
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  
  return {
    light: `rgba(${r}, ${g}, ${b}, 0.15)`,
    medium: `rgba(${r}, ${g}, ${b}, 0.3)`,
    dark: `rgba(${r}, ${g}, ${b}, 0.5)`
  };
};

const ClubCard = memo(function ClubCard({ club, viewMode = 'grid', index = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [imageExtractedColor, setImageExtractedColor] = useState(null);
  
  const cardRef = useRef(null);
  const imageRef = useRef(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Generate initial colors synchronously to prevent flickering
  const initialColors = useMemo(() => {
    const cacheKey = `${club.name}-${club.profilePicture || 'no-image'}`;
    
    if (colorCache.has(cacheKey)) {
      return colorCache.get(cacheKey);
    }
    
    const baseColor = generateColorFromText(club.name);
    const gradientColors = createGradientColors(baseColor);
    
    const colors = { baseColor, gradientColors };
    colorCache.set(cacheKey, colors);
    
    return colors;
  }, [club.name, club.profilePicture]);

  // Use image-extracted color if available, otherwise use initial colors
  const finalColors = imageExtractedColor || initialColors;

  // Check like status
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!user || !club.instagram) return;
      
      try {
        const liked = await likesService.isClubLiked(club.instagram);
        setIsLiked(liked);
      } catch (error) {
        console.error('Error checking like status:', error);
      }
    };
    
    if (user) {
      checkLikeStatus();
    }
  }, [user, club.instagram]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '50px' // Start loading slightly before visible
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);

  // Extract color from image (non-blocking, runs after initial render)
  useEffect(() => {
    if (!isVisible || !club.profilePicture) return;
    
    const cacheKey = `${club.name}-${club.profilePicture}`;
    if (colorCache.has(cacheKey + '-extracted')) {
      const cachedColors = colorCache.get(cacheKey + '-extracted');
      setImageExtractedColor(cachedColors);
      return;
    }

    // Use requestIdleCallback to extract colors during idle time
    const extractColor = () => {
      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.src = club.profilePicture;
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          // Use smaller canvas for performance
          const size = 50;
          canvas.width = size;
          canvas.height = size;
          
          context.drawImage(img, 0, 0, size, size);
          
          const imageData = context.getImageData(0, 0, size, size);
          const data = imageData.data;
          
          let r = 0, g = 0, b = 0, count = 0;
          
          // Sample every 4th pixel for performance
          for (let i = 0; i < data.length; i += 16) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          
          const baseColor = `rgb(${r}, ${g}, ${b})`;
          const gradientColors = createGradientColors(baseColor);
          const extractedColors = { baseColor, gradientColors };
          
          // Cache the extracted colors
          colorCache.set(cacheKey + '-extracted', extractedColors);
          setImageExtractedColor(extractedColors);
        } catch (e) {
          console.warn('Color extraction failed, using fallback');
        }
      };
      
      img.onerror = () => {
        // Keep using the initial colors if image fails
      };
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if (window.requestIdleCallback) {
      window.requestIdleCallback(extractColor, { timeout: 2000 });
    } else {
      setTimeout(extractColor, 100);
    }
  }, [isVisible, club.profilePicture, club.name]);

  const extractQuotedContent = (str) => {
    if (!str) return '';
    const matches = str.match(/"([^"]*)"/g);
    return matches ? matches.map(match => match.slice(1, -1)).join(' ') : str;
  };
  
  const handleCardClick = (e) => {
    if (e.target.closest('.star-button') || e.target.closest('.star-icon')) {
      e.preventDefault();
      return;
    }
    
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      window.location.href = `/club/${club.instagram}`;
    }, 500); 
  };

  const handleLikeToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to save clubs to your favorites",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      setIsLikeLoading(true);
      
      const newLikedState = await likesService.toggleLikeClub(club.instagram);
      setIsLiked(newLikedState);
      
      toast({
        title: newLikedState ? "Club Added to Favorites" : "Club Removed from Favorites",
        description: newLikedState 
          ? `${club.name} has been added to your favorites.` 
          : `${club.name} has been removed from your favorites.`,
        status: newLikedState ? "success" : "info",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error toggling like:", error);
      toast({
        title: "Error",
        description: "Could not update your favorites. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLikeLoading(false);
    }
  };

  // Memoize the card styles to prevent recalculations
  const cardStyles = useMemo(() => ({
    background: `linear-gradient(135deg, ${finalColors.gradientColors.medium}, ${finalColors.gradientColors.dark})`,
    boxShadow: `0 4px 15px -1px ${finalColors.gradientColors.light}, 0 2px 8px -1px rgba(0, 0, 0, 0.1)`,
    borderColor: finalColors.gradientColors.dark,
    transition: imageExtractedColor ? 'all 0.3s ease-in-out' : 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out'
  }), [finalColors, imageExtractedColor]);

  // Grid view card layout
  const GridCard = () => (
    <div
      className="h-full backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-300
                hover:shadow-xl hover:scale-[1.02]
                cursor-pointer flex flex-col"
      style={cardStyles}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10 rounded-xl">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        </div>
      )}

      {user && (
        <button 
          className="absolute top-3 right-3 z-20 star-button p-2 rounded-full 
            bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm
            hover:bg-white dark:hover:bg-dark-card transition-colors
            shadow-md"
          onClick={handleLikeToggle}
          aria-label={isLiked ? "Remove from favorites" : "Add to favorites"}
          disabled={isLikeLoading}
        >
          {isLikeLoading ? (
            <div className="animate-spin h-5 w-5 border-2 border-t-transparent border-yellow-400 rounded-full"></div>
          ) : isLiked ? (
            <FaStar className="text-yellow-400 text-xl star-icon" />
          ) : (
            <FaRegStar className="text-gray-400 hover:text-yellow-400 text-xl star-icon" />
          )}
        </button>
      )}

      <div className="flex flex-col items-center pt-6 pb-3">
        <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 shadow-lg mb-3" 
          style={{ borderColor: finalColors.gradientColors.dark }}>
          {club.profilePicture ? (
            <Image
              ref={imageRef}
              src={club.profilePicture}
              alt={`${club.name} logo`}
              fill
              className="object-cover"
              sizes="(max-width: 80px) 100vw, 80px"
              priority={index < 6} // Only prioritize first 6 images
              loading={index < 6 ? "eager" : "lazy"}
            />
          ) : (
            <div className="w-full h-full bg-light-gray flex items-center justify-center dark:bg-gray-700">
              <FaUserCircle className="text-gray-500 w-full h-full" />
            </div>
          )}
        </div>
        <h3 className="text-xl font-bold text-gray-700 dark:text-white flex items-center gap-1">
          {club.name}
        </h3>
        <p className="text-sm text-gray-700 dark:text-white/80">
          @{club.instagram}
        </p>
      </div>

      <div className="flex-grow px-5 py-3 overflow-hidden">
        <p className="text-gray-700 dark:text-white line-clamp-4 text-sm md:text-base leading-relaxed">
          {extractQuotedContent(club.description || '')}
        </p>
      </div>

      <div className="mt-auto px-3 py-3 overflow-hidden" 
        style={{ background: `${finalColors.gradientColors.dark}` }}>
        <div className="flex flex-wrap gap-1 max-h-[60px] overflow-hidden justify-center">
          {club.categories?.slice(0, 4).map((category, index) => (
            <span
              key={index}
              className="bg-white/30 dark:bg-dark-profile-card/30 
                text-gray-900 dark:text-white 
                px-2 py-0.5 rounded-full text-xs whitespace-nowrap
                shadow-sm"
            >
              {typeof category === 'string' ? category : category.name}
            </span>
          ))}
          {club.categories?.length > 4 && (
            <span className="bg-white/30 dark:bg-dark-profile-card/30 
              text-white dark:text-white 
              px-2 py-0.5 rounded-full text-xs whitespace-nowrap
              shadow-sm">
              +{club.categories.length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // List view card layout
  const ListCard = () => (
    <div
      className="w-full backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-300
                hover:shadow-xl hover:scale-[1.01]
                cursor-pointer"
      style={cardStyles}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10 rounded-xl">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        </div>
      )}

      <div className="flex p-4">
        <div className="mr-4 flex-shrink-0">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 shadow-lg" 
            style={{ borderColor: finalColors.gradientColors.dark }}>
            {club.profilePicture ? (
              <Image
                ref={imageRef}
                src={club.profilePicture}
                alt={`${club.name} logo`}
                fill
                className="object-cover"
                sizes="(max-width: 80px) 100vw, 80px"
                priority={index < 6}
                loading={index < 6 ? "eager" : "lazy"}
              />
            ) : (
              <div className="w-full h-full bg-light-gray flex items-center justify-center dark:bg-gray-700">
                <FaUserCircle className="text-gray-500 w-full h-full" />
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-grow flex flex-col">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-700 dark:text-white flex items-center gap-1">
                {club.name}
              </h3>
              <p className="text-sm text-gray-700 dark:text-white/80">
                @{club.instagram}
              </p>
            </div>
            
            {user && (
              <button 
                className="star-button p-2 rounded-full 
                  bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm
                  hover:bg-white dark:hover:bg-dark-card transition-colors
                  shadow-md"
                onClick={handleLikeToggle}
                aria-label={isLiked ? "Remove from favorites" : "Add to favorites"}
                disabled={isLikeLoading}
              >
                {isLikeLoading ? (
                  <div className="animate-spin h-5 w-5 border-2 border-t-transparent border-yellow-400 rounded-full"></div>
                ) : isLiked ? (
                  <FaStar className="text-yellow-400 text-xl star-icon" />
                ) : (
                  <FaRegStar className="text-gray-400 hover:text-yellow-400 text-xl star-icon" />
                )}
              </button>
            )}
          </div>
          
          <p className="text-gray-700 dark:text-white line-clamp-3 text-sm md:text-base mt-2 leading-relaxed flex-grow">
            {extractQuotedContent(club.description || '')}
          </p>
          
          <div className="flex flex-wrap gap-1 mt-2">
            {club.categories?.slice(0, 3).map((category, index) => (
              <span
                key={index}
                className="bg-white/30 dark:bg-dark-profile-card/30 
                  text-gray-700 dark:text-white 
                  px-2 py-0.5 rounded-full text-xs whitespace-nowrap
                  shadow-sm"
              >
                {typeof category === 'string' ? category : category.name}
              </span>
            ))}
            {club.categories?.length > 3 && (
              <span className="bg-white/30 dark:bg-dark-profile-card/30 
                text-white dark:text-white 
                px-2 py-0.5 rounded-full text-xs whitespace-nowrap
                shadow-sm">
                +{club.categories.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Loading placeholder
  const LoadingPlaceholder = () => (
    <div 
      className={`${viewMode === 'grid' ? 'h-[360px]' : 'h-[120px]'} rounded-xl animate-pulse`}
      style={{
        background: `linear-gradient(135deg, ${initialColors.gradientColors.light}, ${initialColors.gradientColors.medium})`
      }}
    >
      <div className="p-4 h-full flex flex-col justify-center items-center">
        <div className="w-16 h-16 rounded-full bg-white/20 mb-3"></div>
        <div className="w-3/4 h-4 bg-white/20 rounded mb-2"></div>
        <div className="w-1/2 h-3 bg-white/20 rounded"></div>
      </div>
    </div>
  );

  return (
    <div 
      ref={cardRef} 
      className={`fade-in ${isVisible ? 'visible' : ''} h-full`}
    >
      {isVisible ? (
        <Link href={`/club/${club.instagram}`} passHref>
          <div onClick={handleCardClick} className="h-full">
            {viewMode === 'grid' ? <GridCard /> : <ListCard />}
          </div>
        </Link>
      ) : (
        <LoadingPlaceholder />
      )}
    </div>
  );
});

export default ClubCard;