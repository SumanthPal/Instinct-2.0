'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardHeader, CardContent, CardFooter } from './ui/Card';
import { FaUserCircle } from 'react-icons/fa';
import { FaStar, FaRegStar } from 'react-icons/fa';
import { useAuth } from '@/context/auth-context';
import { likesService } from '@/lib/like-service';
import { useToast } from './ui/toast';
import { VscVerifiedFilled } from "react-icons/vsc";

export default function ClubCard({ club, viewMode = 'grid' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [baseColor, setBaseColor] = useState('');
  const [gradientColors, setGradientColors] = useState({
    light: 'rgba(103, 86, 204, 0.3)',
    medium: 'rgba(103, 86, 204, 0.5)',
    dark: 'rgba(103, 86, 204, 0.7)'
  });
  
  const cardRef = useRef(null);
  const imageRef = useRef(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Check if club is liked when user is available
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

  // Intersection Observer to detect when the card is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
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

  // Extract color from image and create gradient colors
  useEffect(() => {
    // Generate a color based on the club name if no profile picture is available
    const generateColorFromText = (text) => {
      if (!text) return 'rgba(103, 86, 204, 1)'; // Default color
      
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
      }
      
      const r = Math.abs((hash & 0xFF0000) >> 16);
      const g = Math.abs((hash & 0x00FF00) >> 8);
      const b = Math.abs(hash & 0x0000FF);
      
      return `rgb(${r}, ${g}, ${b})`;
    };

    // Create gradient colors from base color
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

    if (isVisible) {
      if (club.profilePicture && imageRef.current) {
        // Try to extract color from profile picture
        const img = new window.Image();
        img.crossOrigin = "Anonymous";
        img.src = club.profilePicture;
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          
          context.drawImage(img, 0, 0);
          
          try {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            let r = 0, g = 0, b = 0;
            
            // Get average of all pixels
            for (let i = 0; i < data.length; i += 4) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
            }
            
            r = Math.floor(r / (data.length / 4));
            g = Math.floor(g / (data.length / 4));
            b = Math.floor(b / (data.length / 4));
            
            const baseColorRGB = `rgb(${r}, ${g}, ${b})`;
            setBaseColor(baseColorRGB);
            setGradientColors(createGradientColors(baseColorRGB));
          } catch (e) {
            console.error('Error extracting color:', e);
            // Fallback to name-based color if image processing fails
            const fallbackColor = generateColorFromText(club.name);
            setBaseColor(fallbackColor);
            setGradientColors(createGradientColors(fallbackColor));
          }
        };
        
        img.onerror = () => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Warning: Image color extraction failed, using fallback color.');
          }
          // Fallback to name-based color if image fails to load
          const fallbackColor = generateColorFromText(club.name);
          setBaseColor(fallbackColor);
          setGradientColors(createGradientColors(fallbackColor));
        };
      } else {
        // No profile picture available, generate color from club name
        const fallbackColor = generateColorFromText(club.name);
        setBaseColor(fallbackColor);
        setGradientColors(createGradientColors(fallbackColor));
      }
    }
  }, [isVisible, club.profilePicture, club.name]);

  const extractQuotedContent = (str) => {
    if (!str) return '';
    const matches = str.match(/"([^"]*)"/g);
    return matches ? matches.map(match => match.slice(1, -1)).join(' ') : str;
  };
  
  const handleCardClick = (e) => {
    // Check if the click is coming from the star button
    if (e.target.closest('.star-button') || e.target.closest('.star-icon')) {
      e.preventDefault(); // Prevent navigation
      return;
    }
    
    // Continue with card navigation
    e.preventDefault(); // Prevent default link behavior
    setIsLoading(true);

    // Simulate an action (e.g., navigating to the club's page)
    setTimeout(() => {
      setIsLoading(false);
      window.location.href = `/club/${club.instagram}`; // Navigate to the club's page
    }, 500); 
  };

  const handleLikeToggle = async (e) => {
    e.preventDefault(); // Prevent card navigation
    e.stopPropagation(); // Stop event propagation
    
    if (!user) {
      // Show toast to log in if user isn't authenticated
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
      
      // Call the toggle service
      const newLikedState = await likesService.toggleLikeClub(club.instagram);
      setIsLiked(newLikedState);
      
      // Show toast
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

  // Grid view card layout
  const GridCard = () => (
    <div
      className="h-full backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-300
                hover:shadow-xl hover:scale-[1.02]
                cursor-pointer flex flex-col"
      style={{ 
        background: `linear-gradient(135deg, ${gradientColors.medium}, ${gradientColors.dark})`,
        boxShadow: `0 4px 15px -1px ${gradientColors.light}, 0 2px 8px -1px rgba(0, 0, 0, 0.1)`
      }}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10 rounded-xl">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        </div>
      ) : null}

      {/* Star/Like Button - Only show for logged in users */}
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
          style={{ borderColor: gradientColors.dark }}>
          {club.profilePicture ? (
            <Image
              ref={imageRef}
              src={club.profilePicture}
              alt={`${club.name} logo`}
              fill
              className="object-cover"
              sizes="(max-width: 80px) 100vw, 80px"
              priority
            />
          ) : (
            <div className="w-full h-full bg-light-gray flex items-center justify-center dark:bg-gray-700">
              <FaUserCircle className="text-gray-500 w-full h-full" />
            </div>
          )}
        </div>
        <h3 className="text-xl font-bold text-white dark:text-white flex items-center gap-1">
          {club.name}
          {/* Add verified icon if needed */}
          {/* <VscVerifiedFilled className="text-purple-200" /> */}
        </h3>
        <p className="text-sm text-white/80 dark:text-white/80">
          @{club.instagram}
        </p>
      </div>

      <div className="flex-grow px-5 py-3 overflow-hidden">
        <p className="text-white dark:text-white line-clamp-4 text-sm md:text-base leading-relaxed">
          {extractQuotedContent(club.description || '')}
        </p>
      </div>

      <div className="mt-auto px-3 py-3 overflow-hidden" 
        style={{ background: `${gradientColors.dark}` }}>
        <div className="flex flex-wrap gap-1 max-h-[60px] overflow-hidden justify-center">
          {club.categories?.slice(0, 4).map((category, index) => (
            <span
              key={index}
              className="bg-white/30 dark:bg-dark-profile-card/30 
                text-white dark:text-white 
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
      style={{ 
        background: `linear-gradient(135deg, ${gradientColors.medium}, ${gradientColors.dark})`,
        boxShadow: `0 4px 15px -1px ${gradientColors.light}, 0 2px 8px -1px rgba(0, 0, 0, 0.1)`
      }}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10 rounded-xl">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        </div>
      ) : null}

      <div className="flex p-4">
        <div className="mr-4 flex-shrink-0">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 shadow-lg" 
            style={{ borderColor: gradientColors.dark }}>
            {club.profilePicture ? (
              <Image
                ref={imageRef}
                src={club.profilePicture}
                alt={`${club.name} logo`}
                fill
                className="object-cover"
                sizes="(max-width: 80px) 100vw, 80px"
                priority
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
              <h3 className="text-lg sm:text-xl font-bold text-white dark:text-white flex items-center gap-1">
                {club.name}
                {/* <VscVerifiedFilled className="text-purple-200" /> */}
              </h3>
              <p className="text-sm text-white/80 dark:text-white/80">
                @{club.instagram}
              </p>
            </div>
            
            {/* Star/Like Button - Only show for logged in users */}
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
          
          <p className="text-white dark:text-white line-clamp-3 text-sm md:text-base mt-2 leading-relaxed flex-grow">
            {extractQuotedContent(club.description || '')}
          </p>
          
          <div className="flex flex-wrap gap-1 mt-2">
            {club.categories?.slice(0, 3).map((category, index) => (
              <span
                key={index}
                className="bg-white/30 dark:bg-dark-profile-card/30 
                  text-white dark:text-white 
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
                shadow-sm"
              >
                +{club.categories.length - 3} more
              </span>
            )}
          </div>
        </div>
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
        <div className={`${viewMode === 'grid' ? 'h-[360px]' : 'h-[120px]'} bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse`}></div>
      )}
    </div>
  );
}