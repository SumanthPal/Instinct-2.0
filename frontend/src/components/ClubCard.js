import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardHeader, CardContent, CardFooter } from './ui/Card';
import { FaUserCircle } from 'react-icons/fa';

export default function ClubCard({ club }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const cardRef = useRef(null);

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

  const extractQuotedContent = (str) => {
    if (!str) return '';
    const matches = str.match(/"([^"]*)"/g);
    return matches ? matches.map(match => match.slice(1, -1)).join(' ') : '';
  };

  const handleClick = (e) => {
    e.preventDefault(); // Prevent default link behavior
    setIsLoading(true);

    // Simulate an action (e.g., navigating to the club's page)
    setTimeout(() => {
      setIsLoading(false);
      window.location.href = `/club/${club.instagram}`; // Navigate to the club's page
    }, 1000); 
  };

  return (
    <div ref={cardRef} className={`fade-in ${isVisible ? 'visible' : ''}`}>
      {isVisible ? (
        <Link href={`/club/${club.instagram}`} passHref>
          <div
            onClick={handleClick}
            className="relative p-4 bg-white dark:bg-dark-card rounded-lg shadow-md 
              border border-white dark:border-gray-700 
              transition-all duration-300 
              hover:border-white hover:shadow-lg hover:shadow-white/50 
              cursor-pointer h-[400px] flex flex-col overflow-hidden"
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-dark-text"></div>
              </div>
            ) : null}

            <CardHeader className="flex items-center space-x-4 flex-shrink-0">
              <div className="relative w-20 h-20 rounded-full overflow-hidden">
                {club.profilePicture ? (
                  <Image
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
                <h3 className="text-4xl font-semibold text-gray-900 dark:text-dark-text">
                  {club.name}
                </h3>
                <p className="text-xl text-gray-500 dark:text-dark-text">
                  @{club.instagram}
                </p>
              </div>
            </CardHeader>

            <CardContent className="flex-grow overflow-hidden">
              <p className="text-gray-600 dark:text-dark-text line-clamp-3 text-2xl">
                {extractQuotedContent(club.description || '')}
              </p>
            </CardContent>

            <CardFooter className="flex flex-wrap gap-2 mt-auto pt-2 overflow-hidden">
              <div className="flex flex-wrap gap-2 max-h-[80px] overflow-hidden">
                {club.categories?.map((category, index) => (
                  <span
                    key={index}
                    className="bg-lavender dark:bg-dark-profile-card 
                      text-gray-700 dark:text-dark-text-white 
                      px-3 py-1 rounded-full text-l whitespace-nowrap"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </CardFooter>
          </div>
        </Link>
      ) : (
        <div className="h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
      )}
    </div>
  );
}