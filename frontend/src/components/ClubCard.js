'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardHeader, CardContent, CardFooter } from './ui/Card';
import { FaUserCircle } from 'react-icons/fa';
import { FaStar, FaRegStar } from 'react-icons/fa';
import { useAuth } from '@/context/auth-context';
import { likesService } from '@/lib/like-service';
import { useToast } from './ui/toast'; // Import the hook, not the function
import { VscVerifiedFilled } from "react-icons/vsc";

export default function ClubCard({ club }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [averageColor, setAverageColor] = useState('rgba(103, 86, 204, 0.3)');
  const cardRef = useRef(null);
  const imageRef = useRef(null);
  const { user } = useAuth();
  const { toast } = useToast(); // Use the hook here

  
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
  }, [user, club.instagram]); // Changed from club.id to club.instagram

  // Intersection Observer to detect when the card is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target); // Stop observing once visible
        }
      },
      { threshold: 0.1 } // Trigger when 10% of the card is visible
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


  // Extract average color from image when image loads or use a predefined color scheme
  useEffect(() => {
    // Generate a color based on the club name if no profile picture is available
    const generateColorFromText = (text) => {
      if (!text) return 'rgba(103, 86, 204, 0.3)'; // Default color
      
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
      }
      
      const r = Math.abs((hash & 0xFF0000) >> 16);
      const g = Math.abs((hash & 0x00FF00) >> 8);
      const b = Math.abs(hash & 0x0000FF);
      
      return `rgba(${r}, ${g}, ${b}, 0.3)`;
    };

    if (isVisible) {
      if (club.profilePicture && imageRef.current) {
        // Try to extract color from profile picture
        // Use the global window.Image constructor instead of Next.js Image
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
            
            setAverageColor(`rgba(${r}, ${g}, ${b}, 0.2)`);
          } catch (e) {
            console.error('Error extracting color:', e);
            // Fallback to name-based color if image processing fails
            setAverageColor(generateColorFromText(club.name));
          }
        };
        
        img.onerror = () => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Warning: Image color extraction failed, using fallback color.');
          }
          // Fallback to name-based color if image fails to load
          setAverageColor(generateColorFromText(club.name));
        };
      } else {
        // No profile picture available, generate color from club name
        setAverageColor(generateColorFromText(club.name));
      }
    }
  }, [isVisible, club.profilePicture, club.name]);

  const extractQuotedContent = (str) => {
    if (!str) return '';
    const matches = str.match(/"([^"]*)"/g);
    return matches ? matches.map(match => match.slice(1, -1)).join(' ') : '';
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
    }, 1000); 
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

  return (
    <div ref={cardRef} className={`fade-in ${isVisible ? 'visible' : ''}`}>
      {isVisible ? (
        <Link href={`/club/${club.instagram}`} passHref>
          <div
            onClick={handleCardClick}
            className="relative p-3 bg-white dark:bg-dark-card rounded-lg shadow-md 
              border border-white dark:border-gray-700 
              transition-all duration-300 
              hover:border-white hover:shadow-lg hover:scale-[1.01]
              cursor-pointer h-[360px] flex flex-col overflow-hidden"
            style={{ 
              background: `linear-gradient(to bottom right, white, ${averageColor})`,
              boxShadow: `0 4px 6px -1px ${averageColor}, 0 2px 4px -1px rgba(0, 0, 0, 0.06)`
            }}
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 rounded-lg">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 dark:border-dark-text"></div>
              </div>
            ) : null}

            {/* Star/Like Button - Only show for logged in users */}
            {user && (
              <button 
                className="absolute top-3 right-3 z-20 star-button p-2 rounded-full 
                  hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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

            <CardHeader className="flex items-center space-x-3 flex-shrink-0 py-2 px-3">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2" style={{ borderColor: averageColor }}>
                {club.profilePicture ? (
                  <Image
                    ref={imageRef}
                    src={club.profilePicture}
                    alt={`${club.name} logo`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 64px) 100vw, 64px"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-light-gray flex items-center justify-center dark:bg-gray-700">
                    <FaUserCircle className="text-gray-500 w-full h-full" />
                  </div>
                )}
              </div>
              <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-dark-base flex items-center gap-1">
  {club.name}
  {/* <VscVerifiedFilled className="text-purple-700" /> */}
</h3>
                <p className="text-sm text-gray-500 dark:text-dark-base">
                  @{club.instagram}
                </p>
              </div>
            </CardHeader>

            <CardContent className="flex-grow overflow-hidden px-3 py-2">
            <p className="text-gray-800  line-clamp-4 text-base md:text-lg font-medium leading-relaxed">
            {extractQuotedContent(club.description || '')}
              </p>
            </CardContent>

            <CardFooter className="flex flex-wrap gap-1 mt-auto pt-2 pb-2 px-3 overflow-hidden" 
              style={{ background: `${averageColor}` }}>
              <div className="flex flex-wrap gap-1 max-h-[70px] overflow-hidden">
              {club.categories?.map((category, index) => (
                <span
                  key={index}
                  className="bg-white/90 dark:bg-dark-profile-card 
                    text-gray-700 dark:text-dark-text-white 
                    px-2 py-0.5 rounded-full text-xs whitespace-nowrap"
                >
                  {category.name}
                </span>
              ))}
              </div>
            </CardFooter>
          </div>
        </Link>
      ) : (
        <div className="h-[360px] bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
      )}
    </div>
  );
}