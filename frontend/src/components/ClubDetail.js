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
FaArrowLeft,
} from "react-icons/fa";
import "../../styles/CalendarStyles.css";
import "./ui/Footer";
import Loading from "@/app/loading";
import Link from "next/link";

export default function ClubDetail({ clubData, initialClubPosts, initialClubEvents }) {
const calendarUrl = getCalendarUrl(clubData["instagram_handle"]);
const [selectedDate, setSelectedDate] = useState(new Date());
const [selectedImageData, setSelectedImageData] = useState(null); 
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

const [isLoading, setIsLoading] = useState(!initialClubPosts);
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedImage, setSelectedImage] = useState(null);

const handleImageClick = (imageUrl, imageData = null) => {
console.log("Clicked image URL:", imageUrl, "Data:", imageData);
setSelectedImage(imageUrl);
setSelectedImageData(imageData);
setIsModalOpen(true);
};

const closeModal = () => {
console.log("Modal close triggered");
setIsModalOpen(false);
setSelectedImage(null);
setSelectedImageData(null);
};

// Create a consistent date formatting function that ignores time component
const formatDate = (date) => {
if (!date) return '';
const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
return normalizedDate.toISOString().split('T')[0];
};

useEffect(() => {
console.log("Selected Date:", formatDate(selectedDate));
console.log("Club Events count:", clubEvents.length);
console.log("Club Posts count:", clubPosts.length);

if (clubEvents.length > 0) {
console.log("Sample event dates:", clubEvents.slice(0, 3).map(e => 
e.parsed?.Date ? formatDate(new Date(e.parsed.Date)) : 'No date'
));
}

// Close modal on ESC key press
const handleEscKey = (event) => {
if (event.key === 'Escape' && isModalOpen) {
closeModal();
}
};

document.addEventListener('keydown', handleEscKey);
return () => document.removeEventListener('keydown', handleEscKey);
}, [selectedDate, clubEvents, clubPosts, isModalOpen]);

const handleDateChange = (date) => {
setSelectedDate(date);
};

// Updated function to safely extract post date
const getPostDate = (item, type = "post") => {
if (!item) return null;

try {
if (type === "event") {
if (item.date) {
const dateObj = new Date(item.date);
return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
}
if (item.parsed?.Date) {
const dateObj = new Date(item.parsed.Date);
return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
}
} else if (type === "post") {
if (item.posted) {
const dateObj = new Date(item.posted);
return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
}
}
} catch (e) {
console.error("Failed to parse date for", type, item, e);
}

return null;
};

// Get items for a specific date
const getItemsForDate = (items, date, type = "post") => {
const dateStr = formatDate(date);
return items.filter(item => {
const itemDate = getPostDate(item, type);
return itemDate && formatDate(itemDate) === dateStr;
});
};

// Check if a date has posts or events
const hasItemsOnDate = (items, date, type = "post") => {
const dateStr = formatDate(date);
return items.some(item => {
const itemDate = getPostDate(item, type);
return itemDate && formatDate(itemDate) === dateStr;
});
};

const tileContent = ({ date, view }) => {
if (view !== "month") return null;

const hasPost = hasItemsOnDate(clubPosts, date, "post");
const hasEvent = hasItemsOnDate(clubEvents, date, "event");

if (hasPost && hasEvent) {
return (
<div className="flex justify-center gap-0.5 mt-0.5">
<div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500" />
<div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500" />
</div>
);
} else if (hasPost) {
return <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 mx-auto mt-0.5 sm:mt-1" />;     
} else if (hasEvent) {
return <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 mx-auto mt-0.5 sm:mt-1" />;
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
<div className="min-h-screen overflow-hidden">
<div className="container mx-auto px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6 lg:pt-8 pb-8 sm:pb-12 lg:pb-16 max-w-7xl">

{/* Back Button - Enhanced for mobile */}
<div className="mb-4 sm:mb-6">
<Link 
  href="/clubs"
  className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-full border border-white/20 dark:border-dark-text/10 shadow-md hover:bg-white/40 dark:hover:bg-dark-card/40 transition-all text-dark-base dark:text-dark-text text-sm sm:text-base"
>
  <FaArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
  <span className="font-medium">Back</span>
</Link>
</div>

{/* Header Section - Improved mobile layout */}
<div className="mb-6 sm:mb-8 backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/20 dark:border-dark-text/10 overflow-hidden shadow-md p-4 sm:p-6 lg:p-8">
<div className="flex flex-col items-center space-y-4 sm:space-y-6">
  {/* Profile Image - Responsive sizing */}
  <div className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-32 lg:h-32 rounded-full overflow-hidden border-4 border-white/30 dark:border-dark-text/10 shadow-lg shrink-0">
    <Image
      src={clubData["profile_image_url"]}
      alt={clubData["name"]}
      fill
      className="object-cover"
      sizes="(max-width: 640px) 80px, (max-width: 1024px) 96px, 128px"
      loading="lazy"
      unoptimized
    />
  </div>
  
  {/* Club Info - Better mobile spacing */}
  <div className="text-center w-full">
    <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-2 sm:mb-3 text-dark-base dark:text-white break-words px-2">
      {clubData["name"]}
    </h1>
    
    {/* Stats - Stack on very small screens */}
    <div className="text-base sm:text-lg lg:text-xl flex flex-col xs:flex-row xs:justify-center xs:space-x-6 space-y-1 xs:space-y-0 text-dark-base/80 dark:text-dark-text/80 mb-3 sm:mb-4">
      <span>{clubData.followers} followers</span>
      <span>{clubData.following} following</span>
    </div>
    
    {/* Instagram Link - Full width on mobile */}
    <div className="flex justify-center mb-3 sm:mb-4">
      <a
        href={`https://instagram.com/${clubData["instagram_handle"]}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center px-4 py-2 sm:px-5 sm:py-2.5 rounded-full backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 border border-white/20 dark:border-dark-text/10 hover:bg-white/60 dark:hover:bg-dark-card/60 transform transition-all duration-300 ease-in-out hover:scale-105 text-dark-base dark:text-dark-text text-sm sm:text-base max-w-full"
      >
        <FaInstagram className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
        <span className="font-medium truncate">@{clubData["instagram_handle"]}</span>
      </a>
    </div>
    
    {/* Categories - Responsive wrapping */}
    <div className="flex flex-wrap justify-center gap-2">
      {Array.isArray(clubData.categories) && clubData.categories.map((category, index) => (
        <span
          key={index}
          className="px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 border border-white/20 dark:border-dark-text/10 rounded-full text-dark-base dark:text-dark-text font-medium"
        >
          {category}
        </span>
      ))}
    </div>
  </div>
</div>
</div>

{/* Description - Better mobile typography */}
<div className="mb-6 sm:mb-8 backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/20 dark:border-dark-text/10 shadow-md p-4 sm:p-6">
<p className="text-dark-base dark:text-dark-text text-base sm:text-lg lg:text-xl leading-relaxed">
  {extractQuotedContent(clubData.description) || clubData.description || "No description available."}
</p>
</div>

{/* Links and Calendar Card - Enhanced mobile layout */}
<div className="mb-6 sm:mb-8 backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/20 dark:border-dark-text/10 shadow-md p-4 sm:p-6">
<h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6 text-dark-base dark:text-white">
  Links & Calendar
</h2>

{/* Links - Better mobile spacing */}
{Array.isArray(clubData["club_links"]) && clubData["club_links"].length > 0 && (
  <div className="mb-6">
    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-dark-base dark:text-dark-text">Links</h3>
    <div className="space-y-2 sm:space-y-3">
      {clubData["club_links"].map((linkData, index) => (
        <a
          key={index}
          href={linkData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-3 p-3 sm:p-4 rounded-lg backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 border border-white/20 dark:border-dark-text/10 hover:bg-white/60 dark:hover:bg-dark-card/60 transform transition-all duration-300 ease-in-out hover:scale-[1.01] sm:hover:scale-[1.02] text-dark-base dark:text-dark-text group min-h-[44px]"
        >
          <FaLink className="w-4 h-4 flex-shrink-0 text-dark-base/60 dark:text-dark-text/60 group-hover:text-dark-base dark:group-hover:text-dark-text" />
          <span className="text-sm sm:text-base font-medium truncate flex-1">
            {linkData.text.length > 40
              ? `${linkData.text.substring(0, 40)}...`
              : linkData.text}
          </span>
          <FaExternalLinkAlt className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      ))}
    </div>
  </div>
)}

{/* Calendar Actions - Mobile-first design */}
<div className="mb-6 p-4 sm:p-6 rounded-xl bg-gradient-to-br from-pastel-pink/20 via-lavender/20 to-sky-blue/20 dark:from-dark-card/60 dark:via-dark-profile-card/60 dark:to-dark-gradient-start/60 border-2 border-dashed border-lavender/50 dark:border-dark-gradient-end/50 backdrop-blur-sm">
  <div className="text-center">
    <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-white text-dark-base dark:bg-dark-subtext rounded-full mb-4 shadow-lg">
      <svg className="w-6 h-6 sm:w-8 sm:h-8 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
    <h4 className="text-lg sm:text-xl font-bold text-dark-base dark:text-dark-text-white mb-2">
      Never Miss an Event! 📅
    </h4>
    <p className="text-sm sm:text-base text-dark-base/80 dark:text-dark-subtext mb-4">
      Add {clubData.name}'s events directly to your calendar app and get automatic notifications
    </p>
  </div>
<div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
  <button
    onClick={() => window.open(calendarUrl)}
    className="flex items-center justify-center space-x-3 px-6 py-4 sm:px-8 sm:py-5 rounded-2xl bg-white text-dark-base dark:bg-dark-card dark:text-white font-bold transform transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl shadow-lg text-base sm:text-lg min-h-[56px] relative overflow-hidden group border border-white/10"
  >
    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    <FaDownload className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
    <span className="font-bold relative z-10">Download Calendar</span>
  </button>
  <button
    onClick={() => {
      const subscribeUrl = calendarUrl.replace("https", "webcal");
      window.open(subscribeUrl);
    }}
    className="flex items-center justify-center space-x-3 px-6 py-4 sm:px-8 sm:py-5 rounded-2xl bg-white text-dark-base dark:bg-dark-card dark:text-white font-bold transform transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl shadow-lg text-base sm:text-lg min-h-[56px] relative overflow-hidden group border border-white/20"
  >
    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    <FaGlobe className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
    <span className="font-bold relative z-10">Subscribe to Calendar</span>
  </button>
</div>
</div>
</div>

{/* Posts Grid - Enhanced mobile layout */}
<div className="mb-6 sm:mb-8 backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/20 dark:border-dark-text/10 shadow-md p-4 sm:p-6">
<h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6 text-dark-base dark:text-white">
  Recent Posts
</h2>
{clubPosts.length > 0 ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
    {clubPosts.map((post, index) => (
      <div key={index} className="backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 rounded-xl border border-white/20 dark:border-dark-text/10 overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
        {post.image_url ? (
          <div
            className="relative w-full h-48 sm:h-56 lg:h-64 cursor-pointer touch-manipulation"
            onClick={() => handleImageClick(post.image_url, post)}
          >
            <Image
              src={post.image_url}
              alt="Post Image"
              fill
              className="object-cover hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-full h-48 sm:h-56 lg:h-64 bg-white/20 dark:bg-dark-card/20 flex items-center justify-center">
            <svg
              className="w-12 h-12 sm:w-16 sm:h-16 text-dark-base/40 dark:text-dark-text/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        <div className="p-3 sm:p-4">
          {post.caption && (
            <p className="text-xs sm:text-sm text-dark-base dark:text-dark-text line-clamp-3 mb-2">
              {post.caption}
            </p>
          )}
          {post.posted && (
            <p className="text-xs text-dark-base/60 dark:text-dark-text/60">
              {new Date(post.posted).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    ))}
  </div>
) : (
  <div className="flex flex-col items-center justify-center h-48 sm:h-64 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-xl border border-white/20 dark:border-dark-text/10">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-12 sm:h-16 sm:w-16 text-dark-base/40 dark:text-dark-text/40 mb-3 sm:mb-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
    <p className="text-base sm:text-lg text-dark-base dark:text-dark-text font-medium">
      No posts available
    </p>
    <p className="text-xs sm:text-sm text-dark-base/60 dark:text-dark-text/60 mt-1">
      Check back later for updates
    </p>
  </div>
)}
</div>

{/* Modal for Enlarged Image - Fully responsive */}
{isModalOpen && (
<div 
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-2 sm:p-4"
  onClick={closeModal}
>
  <div 
    className="relative w-full h-full max-w-6xl max-h-full overflow-hidden"
    onClick={(e) => e.stopPropagation()}
  >
    {/* Header with controls - Enhanced mobile layout */}
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-2 sm:p-4 bg-gradient-to-b from-black/50 to-transparent">
      <div className="flex items-center gap-2">
        {/* Download button */}
        <button
          onClick={() => {
            const link = document.createElement('a');
            link.href = selectedImage;
            link.download = 'club-image.jpg';
            link.click();
          }}
          className="backdrop-blur-sm bg-black/50 hover:bg-black/70 text-white p-2.5 sm:p-3 rounded-full transition-all duration-200 hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Download image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        
        {/* Share button */}
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: 'Club Image',
                url: selectedImage
              });
            } else {
              navigator.clipboard.writeText(selectedImage);
            }
          }}
          className="backdrop-blur-sm bg-black/50 hover:bg-black/70 text-white p-2.5 sm:p-3 rounded-full transition-all duration-200 hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Share image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={closeModal}
        className="backdrop-blur-sm bg-black/50 hover:bg-red-500/70 text-white p-2.5 sm:p-3 rounded-full transition-all duration-200 hover:scale-110 hover:rotate-90 min-w-[44px] min-h-[44px] flex items-center justify-center"
        title="Close (ESC)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    {/* Main content container - Better mobile layout */}
    <div className="bg-white dark:bg-gray-900 rounded-none sm:rounded-lg lg:rounded-xl overflow-hidden shadow-2xl h-full flex flex-col">
      {/* Image section - Responsive heights */}
      <div className="relative w-full h-[60vh] sm:h-[65vh] lg:h-[70vh] bg-black">
        <Image
          src={selectedImage}
          alt="Enlarged Post"
          fill
          className="object-contain"
          sizes="100vw"
          loading="eager"
          priority
          unoptimized
        />
      </div>
      
      {/* Description section - Better mobile scrolling */}
      {selectedImageData && (
        <div className="p-3 sm:p-4 lg:p-6 max-h-[40vh] sm:max-h-[35vh] lg:max-h-[30vh] overflow-y-auto overscroll-contain">
          {/* Event title */}
          {(selectedImageData.parsed?.Name || selectedImageData.name) && (
            <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white mb-2 break-words">
              {selectedImageData.parsed?.Name || selectedImageData.name}
            </h3>
          )}
          
          {/* Caption/Description */}
          {(selectedImageData.caption || selectedImageData.details || selectedImageData.parsed?.Details) && (
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed mb-3 break-words">
              {selectedImageData.caption || selectedImageData.details || selectedImageData.parsed?.Details}
            </p>
          )}
          
          {/* Metadata - Better mobile stacking */}
          <div className="flex flex-col gap-2 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {/* Date */}
            {(selectedImageData.posted || selectedImageData.date || selectedImageData.parsed?.Date) && (
              <span className="flex items-center gap-2">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="break-words">
                  {new Date(selectedImageData.posted || selectedImageData.date || selectedImageData.parsed?.Date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </span>
            )}
            
            {/* Location */}
            {(selectedImageData.location || selectedImageData.parsed?.Location) && (
              <span className="flex items-center gap-2">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="break-words">
                  {selectedImageData.location || selectedImageData.parsed?.Location}
                </span>
              </span>
            )}
            
            {/* Link to original post */}
            {selectedImageData.post_url && (
              <a 
                href={selectedImageData.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-500 hover:text-blue-600 transition-colors font-medium min-h-[44px] w-fit"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>View on Instagram</span>
              </a>
            )}
          </div>
        </div>
      )}
      
      {/* Fallback if no description data */}
      {!selectedImageData && (
        <div className="p-4 sm:p-6 text-center text-gray-500 dark:text-gray-400">
          <p className="text-sm sm:text-base">No additional information available for this image.</p>
        </div>
      )}
    </div>

    {/* Keyboard shortcut hint - Hidden on mobile */}
    <div className="absolute bottom-4 right-4 text-white/60 text-xs backdrop-blur-sm bg-black/30 rounded-lg px-2 py-1 hidden sm:block">
      Press <kbd className="bg-white/20 px-1 py-0.5 rounded text-xs">ESC</kbd> to close
    </div>
  </div>
</div>
)}

{/* Calendar Widget - Fully responsive */}
<div className="backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/20 dark:border-dark-text/10 shadow-md p-4 sm:p-6 mb-6 sm:mb-8">
<h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6 text-dark-base dark:text-white text-center sm:text-left">
  Activity Calendar
</h2>

{/* Calendar Legend - Enhanced mobile layout */}
<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 p-3 sm:p-4 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-lg border border-white/20 dark:border-dark-text/10">
  <div className="flex items-center">
    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full bg-blue-500 mr-1.5 sm:mr-2"></div>
    <span className="text-xs sm:text-sm font-medium text-dark-base dark:text-dark-text">Posts</span>
  </div>
  <div className="flex items-center">
    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full bg-green-500 mr-1.5 sm:mr-2"></div>
    <span className="text-xs sm:text-sm font-medium text-dark-base dark:text-dark-text">Events</span>
  </div>
  <div className="flex items-center">
    <div className="flex gap-0.5 mr-1.5 sm:mr-2">
      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full bg-blue-500"></div>
      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full bg-green-500"></div>
    </div>
    <span className="text-xs sm:text-sm font-medium text-dark-base dark:text-dark-text">Both</span>
  </div>
</div>

{/* Calendar Container - Responsive sizing */}
<div className="flex justify-center">
  <div className="w-full max-w-xs sm:max-w-sm lg:max-w-2xl xl:max-w-4xl">
    <Calendar
      onChange={handleDateChange}
      value={selectedDate}
      tileContent={tileContent}
      className="backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 rounded-lg border border-white/20 dark:border-dark-text/10 p-2 sm:p-3 lg:p-4 shadow-md w-full calendar-responsive"
      tileClassName={({ date, view }) => {
        const hasPost = hasItemsOnDate(clubPosts, date, "post");
        const hasEvent = hasItemsOnDate(clubEvents, date, "event");
        
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
</div>
</div>

{/* Posts and Events on Selected Date - Enhanced mobile layout */}
<div className="backdrop-blur-sm bg-white/50 dark:bg-dark-card/50 rounded-xl border border-white/20 dark:border-dark-text/10 shadow-md p-4 sm:p-6">
<h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-3 sm:mb-4 text-dark-base dark:text-white">
  {format(selectedDate, "MMMM d, yyyy")}
</h3>

{/* Posts section */}
{(() => {
  const postsForDate = getItemsForDate(clubPosts, selectedDate, "post");
  
  if (postsForDate.length > 0) {
    return (
      <div className="mb-6">
        <h4 className="text-base sm:text-lg font-semibold mb-3 text-dark-base dark:text-dark-text flex items-center">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500 mr-2"></div>
          Posts ({postsForDate.length})
        </h4>
        <div className="space-y-3 sm:space-y-4">
          {postsForDate.map((post, index) => (
            <div key={`post-${index}`} className="backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 rounded-lg border border-white/20 dark:border-dark-text/10 p-3 sm:p-4">
              {post.caption && (
                <p className="text-sm sm:text-base text-dark-base dark:text-dark-text mb-3 break-words">
                  {post.caption.length > 150 
                    ? post.caption.substring(0, 150) + "..." 
                    : post.caption}
                </p>
              )}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <p className="text-xs sm:text-sm text-dark-base/60 dark:text-dark-text/60">
                  {format(new Date(post.posted), "MMM d, yyyy • h:mm a")}
                </p>
                {post.post_url && (
                  <a 
                    href={post.post_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium w-fit min-h-[44px] sm:min-h-auto touch-manipulation"
                  >
                    View on Instagram
                    <FaExternalLinkAlt className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
})()}

{/* Events section */}
{(() => {
  const eventsForDate = getItemsForDate(clubEvents, selectedDate, "event");
  
  if (eventsForDate.length > 0) {
    return (
      <div className="mb-6">
        <h4 className="text-base sm:text-lg font-semibold mb-3 text-dark-base dark:text-dark-text flex items-center">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500 mr-2"></div>
          Events ({eventsForDate.length})
        </h4>
        <div className="space-y-3 sm:space-y-4">
          {eventsForDate.map((event, index) => (
            <div key={`event-${index}`} className="backdrop-blur-sm bg-white/40 dark:bg-dark-card/40 rounded-lg border border-white/20 dark:border-dark-text/10 p-3 sm:p-4">
              <h5 className="text-base sm:text-lg font-bold mb-2 text-dark-base dark:text-dark-text break-words">
                {event.parsed?.Name || event.name || "Event"}
              </h5>
              {event.image_url && (
                <div 
                  className="relative w-full h-32 sm:h-40 lg:h-48 mb-3 cursor-pointer rounded-lg overflow-hidden touch-manipulation"
                  onClick={() => handleImageClick(event.image_url, event)}
                >
                  <Image
                    src={event.image_url}
                    alt="Event Image"
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 600px, 800px"
                    loading="lazy"
                    unoptimized
                  />
                </div>
              )}
              <p className="text-sm sm:text-base text-dark-base dark:text-dark-text mb-3 break-words">
                {event.parsed?.Details || event.details || event.caption || "No details available"}
              </p>
              <div className="flex flex-col gap-2 text-xs sm:text-sm text-dark-base/60 dark:text-dark-text/60">
                <span className="flex items-center">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span className="break-words">
                    {event.parsed?.Date
                      ? format(new Date(event.parsed.Date), "PPp")
                      : event.date
                      ? format(new Date(event.date), "PPp")
                      : format(new Date(event.posted), "PPp")}
                  </span>
                </span>
                {(event.parsed?.Location || event.location) && (
                  <span className="flex items-center">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span className="break-words">
                      {event.parsed?.Location || event.location}
                    </span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
})()}

{/* No content message */}
{(() => {
  const postsForDate = getItemsForDate(clubPosts, selectedDate, "post");
  const eventsForDate = getItemsForDate(clubEvents, selectedDate, "event");
  
  if (postsForDate.length === 0 && eventsForDate.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 sm:py-12 backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-lg border border-white/20 dark:border-dark-text/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 sm:h-16 sm:w-16 text-dark-base/40 dark:text-dark-text/40 mb-3 sm:mb-4"
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
        <p className="text-base sm:text-lg font-medium text-dark-base dark:text-dark-text mb-2 text-center px-4">
          No activity on {format(selectedDate, "MMMM d, yyyy")}
        </p>
        <p className="text-xs sm:text-sm text-dark-base/60 dark:text-dark-text/60 text-center px-4">
          Select a different date or check back later for updates
        </p>
      </div>
    );
  }
  return null;
})()}
</div>

{/* Enhanced CSS for mobile responsiveness */}
<style jsx global>{`
/* Base animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 0.5s ease-out forwards;
}

@keyframes animate-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-in {
  animation: animate-in 0.3s ease-out forwards;
}

/* Mobile-first responsive calendar */
.calendar-responsive .react-calendar {
  width: 100% !important;
  font-size: 0.675rem;
  max-width: 100%;
}

.calendar-responsive .react-calendar__tile {
  height: 2rem !important;
  font-size: 0.625rem !important;
  padding: 0.125rem !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.calendar-responsive .react-calendar__navigation button {
  font-size: 0.75rem !important;
  padding: 0.5rem 0.25rem !important;
  min-height: 2.5rem;
}

.calendar-responsive .react-calendar__month-view__weekdays {
  font-size: 0.625rem !important;
}

.calendar-responsive .react-calendar__month-view__weekdays__weekday {
  padding: 0.25rem 0.125rem !important;
}

/* Tablet breakpoint */
@media (min-width: 640px) {
  .calendar-responsive .react-calendar {
    font-size: 0.75rem;
  }
  
  .calendar-responsive .react-calendar__tile {
    height: 2.5rem !important;
    font-size: 0.75rem !important;
    padding: 0.25rem !important;
  }
  
  .calendar-responsive .react-calendar__navigation button {
    font-size: 0.875rem !important;
    padding: 0.75rem 0.5rem !important;
  }
  
  .calendar-responsive .react-calendar__month-view__weekdays {
    font-size: 0.75rem !important;
  }
  
  .calendar-responsive .react-calendar__month-view__weekdays__weekday {
    padding: 0.5rem 0.25rem !important;
  }
}

/* Desktop breakpoint */
@media (min-width: 1024px) {
  .calendar-responsive .react-calendar {
    font-size: 1rem;
  }
  
  .calendar-responsive .react-calendar__tile {
    height: 4rem !important;
    font-size: 1rem !important;
    padding: 0.75rem !important;
  }
  
  .calendar-responsive .react-calendar__navigation button {
    font-size: 1.125rem !important;
    padding: 1.25rem !important;
  }
}

/* Extra large screens */
@media (min-width: 1280px) {
  .calendar-responsive .react-calendar {
    font-size: 1.125rem;
  }
  
  .calendar-responsive .react-calendar__tile {
    height: 5rem !important;
    font-size: 1.125rem !important;
    padding: 1rem !important;
  }
  
  .calendar-responsive .react-calendar__navigation button {
    font-size: 1.25rem !important;
    padding: 1.5rem !important;
  }
}

/* Touch-friendly enhancements */
@media (max-width: 640px) {
  .touch-manipulation {
    touch-action: manipulation;
  }
  
  /* Prevent text selection on touch */
  .calendar-responsive .react-calendar__tile {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  
  /* Better line clamping for mobile */
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }
  
  /* Responsive text sizing */
  .text-responsive {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
}

/* Enhanced scrollbar styles */
.modal-content::-webkit-scrollbar {
  width: 3px;
}

@media (min-width: 640px) {
  .modal-content::-webkit-scrollbar {
    width: 6px;
  }
}

.modal-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Responsive grid improvements */
@media (max-width: 640px) {
  .container {
    overflow-x: hidden;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
  
  /* Ensure buttons meet minimum touch target size */
  button, a {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Better text wrapping */
  .break-words {
    word-break: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }
  
  /* Prevent horizontal overflow */
  * {
    max-width: 100%;
  }
  
  img {
    height: auto;
  }
}

/* Very small screen adjustments */
@media (max-width: 480px) {
  .calendar-responsive .react-calendar__tile {
    height: 1.75rem !important;
    font-size: 0.5rem !important;
  }
  
  .calendar-responsive .react-calendar__navigation button {
    font-size: 0.625rem !important;
    padding: 0.25rem !important;
  }
  
  .container {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}

/* Improve focus states for accessibility */
button:focus-visible,
a:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Better modal positioning on mobile */
@media (max-width: 640px) {
  .fixed.inset-0 {
    padding: 0.25rem !important;
  }
  
  .modal-content {
    max-height: 95vh !important;
  }
}

/* iOS Safari specific fixes */
@supports (-webkit-touch-callout: none) {
  .fixed.inset-0 {
    height: -webkit-fill-available;
  }
}

/* Reduce motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
  .fade-in,
  .animate-in,
  .transition-all,
  .hover\\:scale-105,
  .hover\\:scale-\\[1\\.02\\] {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}

@keyframes pulse-glow-themed {
  0% {
    box-shadow: 0 0 0 0 rgba(139, 116, 163, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(139, 116, 163, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(139, 116, 163, 0);
  }
}

.pulse-button-themed {
  animation: pulse-glow-themed 3s infinite;
}

/* Themed shimmer effect */
@keyframes shimmer-themed {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.shimmer-effect-themed::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(230, 208, 255, 0.3),
    transparent
  );
  background-size: 200% 100%;
  animation: shimmer-themed 2.5s infinite;
}

/* Enhanced gradient animation matching your theme */
@keyframes calendar-gradient {
  '0%': { 
    background: linear-gradient(135deg, #463B55, #8574A3);
  },
  '50%': { 
    background: linear-gradient(135deg, #8574A3, #463B55, #E6D0FF);
  },
  '100%': { 
    background: linear-gradient(135deg, #463B55, #8574A3);
  }
}

.animated-gradient-bg {
  animation: calendar-gradient 4s ease-in-out infinite;
}
`}</style>
</div>
</div>
);
}