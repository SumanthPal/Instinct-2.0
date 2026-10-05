"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";
import { getCalendarUrl, fetchSmartSearch } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { likesService } from "@/lib/like-service";
import { useToast } from "@/components/ui/toast";
import ClubProfileHeader from "@/components/club-profile/ClubProfileHeader";
import ClubProfileTabs from "@/components/club-profile/ClubProfileTabs";
import ClubPostGrid from "@/components/club-profile/ClubPostGrid";
import ClubEventsPanel from "@/components/club-profile/ClubEventsPanel";
import ClubSimilarClubs from "@/components/club-profile/ClubSimilarClubs";
import ClubImageModal from "@/components/club-profile/ClubImageModal";
import { calculateActivityScore } from "@/components/club-profile/clubDetailUtils";

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

  const activityInfo = useMemo(
    () => calculateActivityScore(clubPosts, clubData?.followers || 0),
    [clubPosts, clubData?.followers],
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

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape" && isModalOpen) closeModal();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isModalOpen]);

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

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
    setSelectedImageData(null);
  };

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
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="instinct-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--instinct-pink)" />
            <stop offset="50%" stopColor="var(--instinct-purple)" />
            <stop offset="100%" stopColor="var(--instinct-sky)" />
          </linearGradient>
        </defs>
      </svg>

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
        clubData={clubData}
        postCount={clubPosts.length}
        isLiked={isLiked}
        isLikeLoading={isLikeLoading}
        onFavoriteToggle={handleFavoriteToggle}
        activityLabel={activityInfo.label}
      />

      <ClubProfileTabs tab={tab} onTabChange={setTab} />

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
        />
      )}

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
