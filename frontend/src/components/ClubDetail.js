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

export default function ClubDetail({ clubData, initialClubPosts }) {
  const calendarUrl = getCalendarUrl(clubData["Instagram Handle"]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [clubPosts, setClubPosts] = useState(initialClubPosts || []); // Initialize with initialClubPosts
  const [isLoading, setIsLoading] = useState(!initialClubPosts); // Set loading state based on initialClubPosts
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleImageClick = (imageUrl) => {
    console.log("Clicked image URL:", imageUrl); // Debugging
    setSelectedImage(imageUrl);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
  };

  // Fetch posts if not provided initially
  useEffect(() => {
    if (!initialClubPosts) {
      const fetchPosts = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(
            `/api/club-posts?username=${clubData["Instagram Handle"]}`
          );
          const data = await response.json();
          setClubPosts(data);
        } catch (error) {
          console.error("Failed to fetch posts:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchPosts();
    }
  }, [clubData, initialClubPosts]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const postsOnSelectedDate = clubPosts.filter(
    (post) =>
      post.Parsed?.[0]?.Date &&
      new Date(post.Parsed[0].Date).toDateString() ===
        selectedDate.toDateString()
  );

  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const hasPost = clubPosts.some(
        (post) =>
          post.Parsed?.[0]?.Date &&
          new Date(post.Parsed[0].Date).toDateString() === date.toDateString()
      );
      return hasPost ? <div className="indicator"></div> : null;
    }
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
                src={clubData["Profile Picture"]}
                alt={clubData["Club Name"]}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 96px, 128px"
                priority
              />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-3xl sm:text-5xl font-bold mb-2 text-gray-900 dark:text-dark-subtext">
                {clubData["Club Name"]}
              </h1>
              <div className="text-lg sm:text-2xl flex flex-col sm:flex-row sm:space-x-10 text-gray-950 dark:text-dark-text-white mb-2">
                <span>{clubData.Followers} followers</span>
                <span>{clubData.Following} following</span>
                <span>{clubData["Post Count"]} posts</span>
              </div>
              <div className="flex justify-center sm:justify-start gap-2">
                <a
                  href={`https://instagram.com/${clubData["Instagram Handle"]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 rounded-full border border-transparent hover:border-white/20 transform transition-all duration-300 ease-in-out hover:scale-105 text-gray-800 dark:text-dark-subtext bg-white dark:bg-dark-profile-card"
                >
                  <FaInstagram className="w-6 h-6 sm:w-10 sm:h-10" />
                </a>
              </div>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                {clubData.categories?.map((category, index) => (
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
            {extractQuotedContent(clubData.Description[0]) || ""}
          </p>
        </div>
        {/* Links and Calendar Card */}
        <Card className="mb-8 p-4 sm:p-6 bg-white dark:bg-dark-card border border-gray-100 dark:border-gray-700 rounded-lg shadow-md">
          <CardContent>
            <h2 className="text-2xl sm:text-4xl font-semibold mb-4 text-gray-900 dark:text-dark-text">
              Club Links
            </h2>
            <ul className="space-y-3 mb-6">
              {clubData["Club Links"].map((linkData, index) => (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clubPosts.map((post, index) => (
                <div key={index} className="flex flex-col">
                  {post.Picture ? (
                    <div
                      className="relative w-full h-48 sm:h-64 lg:h-80 cursor-pointer"
                      onClick={() => handleImageClick(post.Picture)}
                    >
                      <Image
                        src={post.Picture}
                        alt="Post Image"
                        fill
                        className="rounded-lg object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        priority
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
                  {post.Caption && (
                    <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-dark-text line-clamp-2">
                      {post.Caption}
                    </p>
                  )}
                  {post.Parsed?.[0]?.Date && (
                    <div className="mt-2">
                      <p className="text-sm sm:text-base text-gray-500 dark:text-dark-gradient-start">
                        {new Date(post.Parsed[0].Date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>

          {/* Modal for Enlarged Image */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
              <div className="relative max-w-4xl w-full p-4">
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 text-white text-2xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75"
                >
                  &times;
                </button>
                <div className="relative w-full h-[80vh]">
                  <Image
                    src={selectedImage}
                    alt="Enlarged Post"
                    fill
                    className="rounded-lg object-contain" /* Use object-contain to fit the image */
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 60vw"
                  />
                </div>
              </div>
            </div>
          )}
        </Card>
        {/* Calendar Widget */}
        <div className="mb-8">
          <Card className="mb-8 bg-white dark:bg-dark-card dark:text-dark-text h-auto sm:h-[975px]">
            <CardContent>
              <h2 className="text-2xl sm:text-4xl font-semibold mb-4 text-gray-900 ">
                Calendar w/ Events
              </h2>
              <div className="flex justify-center items-center h-full mt-4">
                <Calendar
                  onChange={handleDateChange}
                  value={selectedDate}
                  tileContent={tileContent}
                  className="transform transition-all duration-300 ease-in-out hover:scale-105  hover:bg-gray-400 font-bold text-lg sm:text-2xl text-gray-900 dark:text-white rounded-lg shadow-md w-full h-full"
                  tileClassName={({ date, view }) => {
                    if (
                      view === "month" &&
                      clubPosts.some(
                        (post) =>
                          post.Parsed?.[0]?.Date &&
                          new Date(post.Parsed[0].Date).toDateString() ===
                            date.toDateString()
                      )
                    ) {
                      return "highlight";
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Posts on Selected Date */}
        <div className="w-full">
          {postsOnSelectedDate.length > 0 ? (
            postsOnSelectedDate.map((post, index) => (
              <Card
                key={index}
                className="mb-4 bg-white dark:bg-dark-card dark:text-dark-text w-full"
              >
                <CardContent>
                  <h2 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-dark-text">
                    {post.Parsed?.[0]?.Name || "Untitled Event"}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-dark-base mb-4">
                    {post.Parsed?.[0]?.Details || "No details available"}
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-dark-base mb-4">
                    {post.Parsed?.[0]?.Date
                      ? format(new Date(post.Parsed[0].Date), "PPpp")
                      : "No date available"}
                  </p>
                  {post.Picture && (
                    <div className="relative w-full h-48 sm:h-64 rounded-lg overflow-hidden">
                      <Image
                        src={post.Picture}
                        alt={post.Parsed?.[0]?.Name || "Event Image"}
                        layout="fill"
                        objectFit="cover"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="mb-4 bg-white dark:bg-dark-card dark:text-dark-text w-full">
              <CardContent className="flex flex-col items-center justify-center h-48 sm:h-64 w-full">
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
