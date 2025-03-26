"use client";

import { useRef, useState } from "react";
import ClubCard from "../components/ClubCard";
import SearchBar from "../components/ui/SearchBar";
import CategoryFilter from "../components/ui/CategoryFilter";
import DarkModeToggle from "../components/ui/DarkModeToggle";
import ParallaxBackground from "../components/ui/ParallaxBackground";
import Footer from "@/components/ui/Footer";
import Navbar from "@/components/ui/Navbar";
import TypingAnimation from "@/components/ui/TypingAnimation";

export default function HomeClient({ detailedClubs, reloadDataJob }) {
  const [searchInput, setSearchInput] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const clubsRef = useRef(null);
  const [visibleClubs, setVisibleClubs] = useState(12);

  const scrollToClubs = () => {
    clubsRef.current.scrollIntoView({ behavior: "smooth" });
  };

  const handleSearchChange = (event) => {
    setSearchInput(event.target.value);
  };

  const formatNextRunTime = (nextRunTime) => {
    if (!nextRunTime) return "Unknown";
    const date = new Date(nextRunTime);
    return date.toLocaleString();
  };

  const handleCategoryChange = (categories) => {
    setSelectedCategories(categories);
  };

  const handleLoadMore = () => {
    setVisibleClubs((prevVisibleClubs) => prevVisibleClubs + 30);
  };

  const filteredClubs = detailedClubs.filter((club) => {
    const matchesSearch = club.name
      .toLowerCase()
      .includes(searchInput.toLowerCase());
    const matchesCategory =
      selectedCategories.length === 0 ||
      selectedCategories.some((category) => club.categories.includes(category));
    return matchesSearch && matchesCategory;
  });

  const allCategories = [
    ...new Set(detailedClubs.flatMap((club) => club.categories)),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink to-sky-blue bg-[length:200%_200%] dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <ParallaxBackground />
      </div>

      <Navbar />
      <main className="w-full px-4 py-24 flex flex-col items-center justify-center text-center">
        <div className="hero min-h-screen flex flex-col items-center justify-center dark:b dark:text-dark-text z-10">
          <div className="flex items-center justify-center space-x-4">
            <h1
              className="font-bold mb-4 text-gray-900 dark:text-dark-card"
              style={{
                fontSize: "clamp(2.5rem, 10vw, 6rem)", // Adjust values as needed
              }}
            >
              Instinct
            </h1>
          </div>

          {/* Typing Animation with Fixed Height */}
          <div className="h-12 sm:h-16 flex items-center justify-center">
            <TypingAnimation />
          </div>

          {/* Responsive "Next Data Update" Text */}
          <div className="mt-4 text-sm sm:text-lg text-gray-700 dark:text-gray-300">
            Next data update: {formatNextRunTime(reloadDataJob.next_run_time)}
          </div>

          {/* Search Bar and Category Filter */}
          <div className="flex flex-col items-start w-full max-w-full mx-auto px-4 sm:px-0">
            <SearchBar
              value={searchInput}
              onChange={handleSearchChange}
              onEnter={scrollToClubs}
            />
            <div className="relative mt-4 w-full">
              <CategoryFilter
                categories={allCategories}
                selectedCategories={selectedCategories}
                onChange={handleCategoryChange}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedCategories.map((category) => (
                  <div
                    key={category}
                    className="inline-flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-2
                      bg-white/80 dark:bg-dark-profile-card/80
                      text-base sm:text-2xl text-gray-900 dark:text-dark-text-white 
                      rounded-full border border-transparent
                      hover:border-white/20 transition-all duration-200"
                  >
                    <span>{category}</span>
                    <button
                      onClick={() =>
                        handleCategoryChange(
                          selectedCategories.filter(
                            (selected) => selected !== category
                          )
                        )
                      }
                      className="text-gray-500 hover:text-red-500 transition-colors duration-200 font-bold text-base sm:text-2xl"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Club Cards Grid */}
        <div
          ref={clubsRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 mt-8 w-full px-4 sm:px-0"
        >
          {filteredClubs.length > 0 ? (
            filteredClubs.slice(0, visibleClubs).map((club) => (
              <ClubCard
                key={club.instagram}
                club={{
                  profilePicture: club["pfp"],
                  name: club["name"],
                  description: club.description[0],
                  instagram: club["instagram"],
                  categories: club["categories"],
                }}
              />
            ))
          ) : (
            <p className="text-gray-700 dark:text-dark-text">
              No clubs available
            </p>
          )}
        </div>

        {/* Load More Button */}
        <button
          onClick={handleLoadMore}
          className="mt-8 opacity-95 px-4 sm:px-8 py-2 sm:py-4 text-lg sm:text-3xl font-bold bg-dark-text-white text-black rounded-xl dark:bg-dark-card dark:hover:shadow-lg hover:bg-violet-300 transition-all duration-300"
        >
          More
        </button>
      </main>
      <Footer />
    </div>
  );
}