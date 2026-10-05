"use client";

import { useEffect, useState, useRef, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaUserCircle, FaStar, FaRegStar } from "react-icons/fa";
import { useAuth } from "@/context/auth-context";
import { likesService } from "@/lib/like-service";
import { useToast } from "./ui/toast";

const ClubCard = memo(function ClubCard({ club, viewMode = "grid", index = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  const cardRef = useRef(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!user || !club.instagram) return;
      try {
        const liked = await likesService.isClubLiked(club.instagram);
        setIsLiked(liked);
      } catch (error) {
        console.error("Error checking like status:", error);
      }
    };
    if (user) checkLikeStatus();
  }, [user, club.instagram]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "50px" },
    );

    if (cardRef.current) observer.observe(cardRef.current);

    return () => {
      if (cardRef.current) observer.unobserve(cardRef.current);
    };
  }, []);

  const extractQuotedContent = (str) => {
    if (!str) return "";
    const matches = str.match(/"([^"]*)"/g);
    return matches ? matches.map((m) => m.slice(1, -1)).join(" ") : str;
  };

  const handleCardClick = (e) => {
    if (e.target.closest(".star-button") || e.target.closest(".star-icon")) {
      e.preventDefault();
    }
  };

  const handleLikeToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();

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
      const newLikedState = await likesService.toggleLikeClub(club.instagram);
      setIsLiked(newLikedState);
      toast({
        title: newLikedState
          ? "Club Added to Favorites"
          : "Club Removed from Favorites",
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

  const StarButton = ({ className = "" }) =>
    user ? (
      <button
        type="button"
        className={`star-button z-20 rounded-md border p-2 transition-colors ${
          isLiked
            ? "instinct-star-fav is-active"
            : "border-border bg-card text-muted-foreground hover:text-foreground"
        } ${className}`}
        onClick={handleLikeToggle}
        aria-label={isLiked ? "Remove from favorites" : "Add to favorites"}
        disabled={isLikeLoading}
      >
        {isLikeLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        ) : isLiked ? (
          <FaStar className="instinct-star-fill text-base star-icon" />
        ) : (
          <FaRegStar className="text-base star-icon" />
        )}
      </button>
    ) : null;

  const Avatar = ({ sizeClass }) => (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-border ${sizeClass}`}
    >
      {club.profilePicture ? (
        <Image
          src={club.profilePicture}
          alt={`${club.name} logo`}
          fill
          className="object-cover"
          sizes="80px"
          priority={index < 6}
          loading={index < 6 ? "eager" : "lazy"}
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <FaUserCircle className="h-full w-full text-muted-foreground" />
        </div>
      )}
    </div>
  );

  const CategoryTags = ({ limit }) => (
    <div className="flex max-h-[60px] flex-wrap justify-center gap-1 overflow-hidden">
      {club.categories?.slice(0, limit).map((category, i) => (
        <span
          key={i}
          className="instinct-tag whitespace-nowrap rounded-md border px-2 py-0.5 text-xs"
        >
          {typeof category === "string" ? category : category.name}
        </span>
      ))}
      {club.categories?.length > limit && (
        <span className="instinct-tag whitespace-nowrap rounded-md border px-2 py-0.5 text-xs">
          +{club.categories.length - limit} more
        </span>
      )}
    </div>
  );

  const GridCard = () => (
    <div className="instinct-card relative flex h-full flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className="relative">
        <StarButton className="absolute right-3 top-3" />
      </div>

      <div className="flex flex-col items-center px-4 pb-3 pt-6">
        <div className="mb-3">
          <Avatar sizeClass="h-20 w-20" />
        </div>
        <h3 className="px-2 text-center text-lg font-semibold tracking-tight text-foreground">
          {club.name}
        </h3>
        <p className="mt-0.5 font-mono text-sm text-muted-foreground">
          @{club.instagram}
        </p>
      </div>

      <div className="grow overflow-hidden px-5 py-3">
        <p className="line-clamp-4 text-center text-sm leading-relaxed text-muted-foreground">
          {extractQuotedContent(club.description || "")}
        </p>
      </div>

      <div className="instinct-divider mt-auto border-t bg-muted/20 px-3 py-3">
        <CategoryTags limit={4} />
      </div>
    </div>
  );

  const ListCard = () => (
    <div className="instinct-card relative w-full overflow-hidden rounded-md border border-border bg-card">
      <div className="flex p-4">
        <div className="mr-4 shrink-0">
          <Avatar sizeClass="h-16 w-16 sm:h-20 sm:w-20" />
        </div>

        <div className="flex grow flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 text-left">
              <h3 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {club.name}
              </h3>
              <p className="font-mono text-sm text-muted-foreground">
                @{club.instagram}
              </p>
            </div>
            <StarButton className="shrink-0" />
          </div>

          <p className="mt-2 grow text-left text-sm leading-relaxed text-muted-foreground line-clamp-3 md:text-base">
            {extractQuotedContent(club.description || "")}
          </p>

          <div className="mt-2 flex justify-start">
            <CategoryTags limit={3} />
          </div>
        </div>
      </div>
    </div>
  );

  const LoadingPlaceholder = () => (
    <div
      className={`${
        viewMode === "grid" ? "h-[360px]" : "h-[120px]"
      } animate-pulse rounded-md border border-border bg-muted/40`}
    >
      <div className="flex h-full flex-col items-center justify-center p-4">
        <div className="mb-3 h-16 w-16 rounded-full bg-muted" />
        <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );

  return (
    <div
      ref={cardRef}
      className={`fade-in h-full ${isVisible ? "visible" : ""}`}
    >
      {isVisible ? (
        <Link href={`/club/${club.instagram}`} passHref>
          <div onClick={handleCardClick} className="h-full">
            {viewMode === "grid" ? <GridCard /> : <ListCard />}
          </div>
        </Link>
      ) : (
        <LoadingPlaceholder />
      )}
    </div>
  );
});

export default ClubCard;
