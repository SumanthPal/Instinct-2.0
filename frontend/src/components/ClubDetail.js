"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
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
import PostViewer from "@/components/club-profile/post-viewer/PostViewer";
import { eventsByPost } from "@/components/club-profile/post-viewer/post-utils";
import { usePostParam } from "@/components/club-profile/post-viewer/usePostParam";
import { useClubPosts } from "@/components/club-profile/post-viewer/useClubPosts";

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

  const postFeed = useClubPosts(clubData?.instagram_handle, initialClubPosts);
  const clubPosts = postFeed.posts;
  const [clubEvents] = useState(() => normalizeList(initialClubEvents));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tab, setTab] = useState("posts");
  const [similarClubs, setSimilarClubs] = useState([]);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const postEvents = useMemo(() => eventsByPost(clubEvents), [clubEvents]);
  const viewer = usePostParam(clubPosts);
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

  const { open: openPost, close: closePost } = viewer;
  const handlePostIndex = useCallback(
    (i) => openPost(clubPosts[i]?.id),
    [openPost, clubPosts],
  );
  const showEvents = useCallback(() => {
    closePost();
    setTab("events");
  }, [closePost]);

  // Events tab: an event's image opens the post it was parsed from.
  const handleEventImageClick = (_imageUrl, item) => {
    const id = item?.post_id ?? item?.id;
    if (clubPosts.some((p) => String(p.id) === String(id))) openPost(id);
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
          <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
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
          <ClubPostGrid
            posts={clubPosts}
            handle={clubData.instagram_handle}
            onOpen={(post) => openPost(post.id)}
            hasMore={postFeed.hasMore}
            loadingMore={postFeed.loading}
            onLoadMore={postFeed.loadMore}
          />
        ) : (
          <ClubEventsPanel
            clubData={clubData}
            clubEvents={clubEvents}
            clubPosts={clubPosts}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            calendarUrl={calendarUrl}
            onImageClick={handleEventImageClick}
          />
        )}
      </div>

      <ClubSimilarClubs clubs={similarClubs} />

      <PostViewer
        posts={clubPosts}
        index={viewer.index}
        club={clubData}
        eventsByPost={postEvents}
        total={postFeed.total}
        hasMore={postFeed.hasMore}
        onNeedMore={postFeed.loadMore}
        onIndexChange={handlePostIndex}
        onClose={closePost}
        onShowEvents={showEvents}
      />
    </div>
  );
}
