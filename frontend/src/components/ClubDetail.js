"use client";
import Image from "next/image";
import { Card, CardContent } from "./ui/Card";
import Button from "@/components/ui/Button";
import { getCalendarUrl } from "@/lib/api";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import Calendar from "react-calendar";
import {
  FaDownload,
  FaGlobe,
  FaInstagram,
  FaLink,
  FaExternalLinkAlt,
} from "react-icons/fa";
import "../../styles/CalendarStyles.css";
import "./ui/Footer";
import Loading from "@/app/loading"; // Import the Loading component

export default function ClubDetail({ clubData, initialClubPosts, initialClubEvents }) {
  const calendarUrl = getCalendarUrl(clubData["instagram_handle"]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Ensure clubPosts is always an array, check if it's inside a results property
  const [clubPosts, setClubPosts] = useState(() => {
    console.log("initialClubPosts type:", typeof initialClubPosts);
    console.log("initialClubPosts value:", initialClubPosts);
    
    // Check if data is in a results array
    if (initialClubPosts && initialClubPosts.results && Array.isArray(initialClubPosts.results)) {
      return initialClubPosts.results;
    }
    // Check if it's already an array
    else if (Array.isArray(initialClubPosts)) {
      return initialClubPosts;
    }
    // Default to empty array
    return [];
  });
  
  // Same safety check for clubEvents
  const [clubEvents, setClubEvents] = useState(() => {
    console.log("initialClubEvents type:", typeof initialClubEvents);
    console.log("initialClubEvents value:", initialClubEvents);
    
    // Check if data is in a results array
    if (initialClubEvents && initialClubEvents.results && Array.isArray(initialClubEvents.results)) {
      return initialClubEvents.results;
    }
    // Check if it's already an array
    else if (Array.isArray(initialClubEvents)) {
      return initialClubEvents;
    }
    // Default to empty array
    return [];
  });
  
  const [isLoading, setIsLoading] = useState(!initialClubPosts); // Set loading state based on initialClubPosts
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleImageClick = (imageUrl) => {
    console.log("Clicked image URL:", imageUrl); // Debugging
    setSelectedImage(imageUrl);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    console.log("Modal close triggered");
    setIsModalOpen(false);
    setSelectedImage(null);
  };

  // Fetch posts if not provided initially
  const formatDate = (date) => date.toISOString().split("T")[0];

  useEffect(() => {
    console.log("Selected Date:", formatDate(selectedDate));
    console.log("Club Events count:", clubEvents.length);
    console.log("Club Posts count:", clubPosts.length);
    
    // Debug event dates
    if (clubEvents.length > 0) {
      console.log("Sample event dates:", clubEvents.slice(0, 3).map(e => 
        e.parsed?.Date ? formatDate(new Date(e.parsed.Date)) : 'No date'
      ));
    }
  }, [selectedDate, clubEvents, clubPosts]);
  
  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  // Function to safely extract post date
  const getPostDate = (post) => {
    if (!post) return null;
    
    // Try to get date from parsed.Date
    if (post.parsed && post.parsed.Date) {
      try {
        return new Date(post.parsed.Date);
      } catch (e) {
        console.error("Error parsing post.parsed.Date:", e);
      }
    }
    
    // Fall back to posted field
    if (post.posted) {
      try {
        return new Date(post.posted);
      } catch (e) {
        console.error("Error parsing post.posted:", e);
      }
    }
    
    return null;
  };

  const postsOnSelectedDate = clubEvents.filter((event) => {
    const postDate = getPostDate(event);
    if (!postDate) return false;
    
    return formatDate(postDate) === formatDate(selectedDate);
  });
  
  const tileContent = ({ date, view }) => {
    if (view === "month") {
      // Check if there are posts on this date
      const hasPost = clubPosts.some((post) => {
        const postDate = getPostDate(post);
        return postDate && formatDate(postDate) === formatDate(date);
      });
      
      // Check if there are events on this date
      const hasEvent = clubEvents.some((event) => {
        const eventDate = getPostDate(event);
        return eventDate && formatDate(eventDate) === formatDate(date);
      });
      
      // Return different indicators based on what's available
      if (hasPost && hasEvent) {
        // Both post and event
        return (
          <div className="flex justify-center gap-1 mt-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
        );
      } else if (hasPost) {
        // Only post
        return <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto mt-1" />;
      } else if (hasEvent) {
        // Only event
        return <div className="w-2 h-2 rounded-full bg-green-500 mx-auto mt-1" />;
      }
      
      return null;
    }
    return null;
  };
  
  const extractQuotedContent = (str) => {
    if (!str) return "";
    const matches = str.match(/"([^"]*)"/g);
    return matches ? matches.map((match) => match.slice(1, -1)).join(" ") : "";
  };

  // Show loading spinner while fetching posts
  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[100vw] mx-auto px-4 sm:px-6 py-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8">
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden">
              <Image
                src={clubData["profile_pic"]}
                alt={clubData["name"]}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 96px, 128px"
                loading="lazy"
              />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-3xl sm:text-5xl font-bold mb-2 text-gray-900 dark:text-dark-subtext">
                {clubData["name"]}
              </h1>
              <div className="text-lg sm:text-2xl flex flex-col sm:flex-row sm:space-x-10 text-gray-950 dark:text-dark-text-white mb-2">
                <span>{clubData.followers} followers</span>
                <span>{clubData.following} following</span>
                {/* <span>{clubData["Post Count"]} posts</span> */}
              </div>
              <div className="flex justify-center sm:justify-start gap-2">
                <a
                  href={`https://instagram.com/${clubData["instagram_handle"]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 rounded-full border border-transparent hover:border-white/20 transform transition-all duration-300 ease-in-out hover:scale-105 text-gray-800 dark:text-dark-subtext bg-white dark:bg-dark-profile-card"
                >
                  <FaInstagram className="w-6 h-6 sm:w-10 sm:h-10" />
                </a>
              </div>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                {Array.isArray(clubData.categories) && clubData.categories.map((category, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-sm bg-gray-100 dark:bg-dark-profile-card rounded-full text-gray-700 dark:text-dark-text"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Description */}
        <div className="mb-8 px-4 py-4 rounded-lg">
          <p className="text-gray-700 dark:text-gray-300 text-lg sm:text-3xl">
            {extractQuotedContent(clubData.description) || ""}
          </p>
        </div>
        {/* Links and Calendar Card */}
        <Card className="mb-8 p-4 sm:p-6 bg-white dark:bg-dark-card border border-gray-100 dark:border-gray-700 rounded-lg shadow-md">
          <CardContent>
            <h2 className="text-2xl sm:text-4xl font-semibold mb-4 text-gray-900 dark:text-dark-text">
              Club Links
            </h2>
            <ul className="space-y-3 mb-6">
              {Array.isArray(clubData["club_links"]) && clubData["club_links"].map((linkData, index) => (
                <li key={index}>
                  <a
                    href={linkData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-3 p-4 sm:p-6 rounded-lg bg-gray-100 dark:bg-dark-profile-card text-dark-base hover:bg-gray-200 dark:hover:bg-dark-gradient-start transform transition-all duration-300 ease-in-out hover:scale-105 dark:text-gray-200"
                  >
                    <FaLink className="w-4 h-4 flex-shrink-0 font-bold" />
                    <span className="text-lg sm:text-2xl font-bold truncate">
                      {linkData.text.length > 40
                        ? `${linkData.text.substring(0, 40)}...`
                        : linkData.text}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {/* Calendar Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button
                onClick={() => window.open(calendarUrl)}
                className="flex items-center justify-center space-x-2 px-4 py-3 sm:px-6 sm:py-4 rounded-full bg-gray-100 dark:bg-dark-profile-card hover:bg-gray-200 dark:hover:bg-dark-gradient-start transform transition-all duration-300 ease-in-out hover:scale-105"
              >
                <FaDownload className="w-6 h-6 sm:w-8 sm:h-8 text-dark-base dark:text-gray-200" />
                <span className="text-lg sm:text-2xl font-bold text-dark-text dark:text-gray-200">
                  Download Calendar
                </span>
              </Button>
              <Button
                onClick={() => {
                  const subscribeUrl = calendarUrl.replace("https", "webcal");
                  window.open(subscribeUrl);
                }}
                className="flex items-center justify-center space-x-2 px-4 py-3 sm:px-6 sm:py-4 rounded-full bg-gray-100 dark:bg-dark-profile-card hover:bg-gray-200 dark:hover:bg-dark-gradient-start transform transition-all duration-300 ease-in-out hover:scale-105 text-dark-base dark:text-gray-200 font-bold"
              >
                <FaGlobe className="w-6 h-6 sm:w-8 sm:h-8 text-dark-base dark:text-gray-200" />
                <span className="text-lg sm:text-2xl font-bold text-dark-text dark:text-gray-200">
                  Subscribe to Calendar
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Grid of Posts */}
        <Card className="mb-8 bg-white dark:bg-dark-card">
          <CardContent>
            <h2 className="text-2xl sm:text-4xl font-semibold mb-4 text-gray-900 dark:text-dark-text">
              Posts
            </h2>
            {clubPosts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {clubPosts.map((post, index) => (
                  <div key={index} className="flex flex-col">
                    {post.image_url ? (
                      <div
                        className="relative w-full h-48 sm:h-64 lg:h-80 cursor-pointer"
                        onClick={() => handleImageClick(post.image_url)}
                      >
                        <Image
                          src={post.image_url}
                          alt="Post Image"
                          fill
                          className="rounded-lg object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 sm:h-64 lg:h-80 bg-gray-300 dark:bg-[#4D4855] flex items-center justify-center rounded-lg">
                        <svg
                          className="w-16 h-16 text-gray-400 dark:text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 7h18M3 12h18M3 17h18"
                          />
                        </svg>
                      </div>
                    )}
                    {post.caption && (
                      <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-dark-text line-clamp-2">
                        {post.Caption}
                      </p>
                    )}
                    {post.caption && (
                      <div className="mt-2">
                        <p className="text-sm sm:text-base text-gray-500 dark:text-dark-gradient-start">
                          {new Date(post.posted).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 sm:h-64">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-16 w-16 text-gray-500 dark:text-dark-text"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 7h18M3 12h18M3 17h18"
                  />
                </svg>
                <p className="text-sm sm:text-base text-gray-700 dark:text-dark-text mt-4">
                  No posts available
                </p>
              </div>
            )}
          </CardContent>

          {/* Modal for Enlarged Image */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
              <div className="relative max-w-4xl w-full p-4">
              <button
                onClick={closeModal}
                style={{ zIndex: 9999 }}
                className="absolute top-4 right-4 text-white text-2xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75"
              >
                &times;
              </button>
                <div className="relative w-full h-[80vh]">
                  <Image
                    src={selectedImage}
                    alt="Enlarged Post"
                    fill
                    className="rounded-lg object-contain" 
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 60vw"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          )}
        </Card>
        {/* Calendar Widget */}
        
    {/* Calendar */}
  <div className="w-full">
    <Card className="bg-white dark:bg-dark-card dark:text-dark-text h-auto">
      <CardContent>
        <h2 className="text-2xl sm:text-4xl font-semibold mb-4 text-gray-900 dark:text-dark-text">Calendar</h2>
        
        {/* Calendar Legend */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">Posts</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">Events</span>
          </div>
          <div className="flex items-center">
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Both</span>
          </div>
        </div>
        
        <div className="flex justify-center items-center mt-4">
          <Calendar
            onChange={handleDateChange}
            value={selectedDate}
            tileContent={tileContent}
            className="transition-transform duration-300 ease-in-out hover:scale-105 font-bold text-lg sm:text-2xl text-gray-900 dark:text-white w-full rounded-lg shadow-md"
            tileClassName={({ date, view }) => {
              // Check for posts
              const hasPost = clubPosts.some(post => {
                const postDate = getPostDate(post);
                return postDate && formatDate(postDate) === formatDate(date);
              });
              
              // Check for events
              const hasEvent = clubEvents.some(event => {
                const eventDate = getPostDate(event);
                return eventDate && formatDate(eventDate) === formatDate(date);
              });
              
              // Apply appropriate classes
              let classes = [];
              
              if (hasPost || hasEvent) {
                classes.push('highlight');
              }
              
              if (hasPost && hasEvent) {
                classes.push('both-indicators');
              } else if (hasPost) {
                classes.push('post-indicator');
              } else if (hasEvent) {
                classes.push('event-indicator');
              }
              
              return classes.join(' ');
            }}
            
          />
        </div>
      </CardContent>
    </Card>
  </div>

  {/* Posts and Events on Selected Date */}
  <div className="w-full flex flex-col gap-4 mt-6">
    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
      {format(selectedDate, "MMMM d, yyyy")}
    </h3>
    
    {/* Posts section */}
    {(() => {
      // Find posts for selected date
      const postsForDate = clubPosts.filter(post => {
        const postDate = getPostDate(post);
        return postDate && formatDate(postDate) === formatDate(selectedDate);
      });
      
      if (postsForDate.length > 0) {
        return (
          <div className="mb-4">
            <h4 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
              Posts ({postsForDate.length})
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {postsForDate.map((post, index) => (
                <Card key={`post-${index}`} className="bg-white dark:bg-dark-card dark:text-dark-text">
                  <CardContent className="p-4">
                    {post.image_url && (
                      <div 
                        className="relative w-full h-40 mb-3 cursor-pointer"
                        onClick={() => handleImageClick(post.image_url)}
                      >
                        <Image
                          src={post.image_url}
                          alt="Post Image"
                          fill
                          className="rounded-lg object-cover"
                          sizes="(max-width: 640px) 100vw, 600px"
                          loading="lazy"
                        />
                      </div>
                    )}
                    {post.caption && (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {post.caption.length > 200 
                          ? post.caption.substring(0, 200) + "..." 
                          : post.caption}
                      </p>
                    )}
                    <div className="mt-2 flex justify-between items-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(post.posted), "MMM d, yyyy • h:mm a")}
                      </p>
                      {post.post_url && (
                        <a 
                          href={post.post_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View on Instagram
                          <FaExternalLinkAlt className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      }
      return null;
    })()}
    
    {/* Events section */}
    {(() => {
      // Find events for selected date
      const eventsForDate = clubEvents.filter(event => {
        const eventDate = getPostDate(event);
        return eventDate && formatDate(eventDate) === formatDate(selectedDate);
      });
      
      if (eventsForDate.length > 0) {
        return (
          <div className="mb-4">
            <h4 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              Events ({eventsForDate.length})
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {eventsForDate.map((event, index) => (
                <Card key={`event-${index}`} className="bg-white dark:bg-dark-card dark:text-dark-text w-full">
                  <CardContent className="p-4">
                    <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-dark-text">
                      {event.parsed?.Name || "Event"}
                    </h2>
                    {event.image_url && (
                      <div 
                        className="relative w-full h-40 mb-3 cursor-pointer"
                        onClick={() => handleImageClick(event.image_url)}
                      >
                        <Image
                          src={event.image_url}
                          alt="Event Image"
                          fill
                          className="rounded-lg object-cover"
                          sizes="(max-width: 640px) 100vw, 600px"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <p className="text-sm text-gray-700 dark:text-dark-text mb-2">
                      {event.parsed?.Details || event.caption || "No details available"}
                    </p>
                    <div className="flex items-center mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        {event.parsed?.Date
                          ? format(new Date(event.parsed.Date), "PPp")
                          : format(new Date(event.posted), "PPp")}
                      </span>
                      {event.parsed?.Location && (
                        <span className="flex items-center ml-4">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          </svg>
                          {event.parsed.Location}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      }
      return null;
    })()}
    
    {/* No content message */}
    {(() => {
      const postsForDate = clubPosts.filter(post => {
        const postDate = getPostDate(post);
        return postDate && formatDate(postDate) === formatDate(selectedDate);
      });
      
      const eventsForDate = clubEvents.filter(event => {
        const eventDate = getPostDate(event);
        return eventDate && formatDate(eventDate) === formatDate(selectedDate);
      });
      
      if (postsForDate.length === 0 && eventsForDate.length === 0) {
        return (
          <Card className="bg-white dark:bg-dark-card dark:text-dark-text w-full">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-gray-400 dark:text-gray-600 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-lg text-gray-700 dark:text-gray-300">
                No posts or events for {format(selectedDate, "MMMM d, yyyy")}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Select a different date or check back later
              </p>
            </CardContent>
          </Card>
        );
      }
      return null;
    })()}
  </div>
</div>

      </div>
  );
}