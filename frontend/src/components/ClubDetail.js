"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";
import { getCalendarUrl, fetchSmartSearch } from "@/lib/api";
import {
  categoryNames,
  normalizeHandle,
} from "@/components/club-profile/clubDetailUtils";
import { useAuth } from "@/context/auth-context";
import { likesService } from "@/lib/like-service";
import { useToast } from "@/components/ui/toast";
import ClubProfileHeader from "@/components/club-profile/ClubProfileHeader";
import ClubProfileTabs, {
  panelId,
  tabId,
} from "@/components/club-profile/ClubProfileTabs";
import ClubPostGrid from "@/components/club-profile/ClubPostGrid";
import ClubEventsPanel from "@/components/club-profile/ClubEventsPanel";
import ClubSimilarClubs from "@/components/club-profile/ClubSimilarClubs";
import ClubImageModal from "@/components/club-profile/ClubImageModal";

function normalizeList(input) {
  if (input?.results && Array.isArray(input.results)) return input.results;
  if (Array.isArray(input)) return input;
  return [];
}

export default function ClubDetail({
  clubData,
  initialClubPosts,
  initialClubEvents,
}) {
  const calendarUrl = getCalendarUrl(clubData?.instagram_handle);
  const { user } = useAuth();
  const { toast } = useToast();

  const [clubPosts] = useState(() => normalizeList(initialClubPosts));
  const [clubEvents] = useState(() => normalizeList(initialClubEvents));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tab, setTab] = useState("posts");
  const [similarClubs, setSimilarClubs] = useState([]);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageData, setSelectedImageData] = useState(null);
  const [extraCategories, setExtraCategories] = useState(() =>
    categoryNames(clubData?.categories),
  );


  useEffect(() => {
    const check = async () => {
      if (!user || !clubData?.instagram_handle) return;
      try {
        const liked = await likesService.isClubLiked(clubData.instagram_handle);
        setIsLiked(liked);
      } catch (e) {
        console.error("Error checking like status:", e);
      }
    };
    check();
  }, [user, clubData?.instagram_handle]);


  // Single-club API omits categories; enrich from smart-search when missing.
  useEffect(() => {
    if (categoryNames(clubData?.categories).length) {
      setExtraCategories(categoryNames(clubData.categories));
      return;
    }
    const handle = clubData?.instagram_handle;
    if (!handle) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await fetchSmartSearch(handle, 1, 5);
        // Exact handle match only: a fuzzy top hit would show another
        // club's categories on this profile.
        const wanted = normalizeHandle(handle);
        const match = (results.results || []).find(
          (c) => normalizeHandle(c.instagram_handle) === wanted,
        );
        const cats = categoryNames(match?.categories);
        if (!cancelled && cats.length) setExtraCategories(cats);
      } catch (e) {
        console.error("Error enriching categories:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubData]);

  useEffect(() => {
    const fetchSimilar = async () => {
      if (!clubData?.name) return;
      try {
        const results = await fetchSmartSearch(clubData.name, 1, 5);
        const filtered = (results.results || []).filter(
          (club) => club.instagram_handle !== clubData.instagram_handle,
        );
        setSimilarClubs(filtered);
      } catch (error) {
        console.error("Error fetching similar clubs:", error);
      }
    };
    fetchSimilar();
  }, [clubData]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedImage(null);
    setSelectedImageData(null);
  }, []);

  const handleImageClick = (imageUrl, imageData = null) => {
    if (!imageUrl) return;
    setSelectedImage(imageUrl);
    setSelectedImageData(imageData);
    setIsModalOpen(true);
  };

  const handleFavoriteToggle = async (e) => {
    e?.preventDefault?.();
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
      const next = await likesService.toggleLikeClub(clubData.instagram_handle);
      setIsLiked(next);
      toast({
        title: next ? "Club Added to Favorites" : "Club Removed from Favorites",
        description: next
          ? `${clubData.name} has been added to your favorites.`
          : `${clubData.name} has been removed from your favorites.`,
        status: next ? "success" : "info",
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

  if (!clubData) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Club not found.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
<div className="mb-6 px-4 sm:px-0">
        <Link
          href="/clubs"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <FaArrowLeft className="h-3.5 w-3.5" />
          Clubs
        </Link>
      </div>

      <ClubProfileHeader
        clubData={{ ...clubData, categories: extraCategories }}
        isLiked={isLiked}
        isLikeLoading={isLikeLoading}
        onFavoriteToggle={handleFavoriteToggle}
      />

      <ClubProfileTabs tab={tab} onTabChange={setTab} />

      <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
        {tab === "posts" ? (
          <ClubPostGrid posts={clubPosts} onImageClick={handleImageClick} />
        ) : (
          <ClubEventsPanel
            clubData={clubData}
            clubEvents={clubEvents}
            clubPosts={clubPosts}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            calendarUrl={calendarUrl}
            onImageClick={handleImageClick}
          />
        )}
      </div>

      <ClubSimilarClubs clubs={similarClubs} />

      <ClubImageModal
        open={isModalOpen}
        imageUrl={selectedImage}
        imageData={selectedImageData}
        onClose={closeModal}
      />
    </div>
  );
}
