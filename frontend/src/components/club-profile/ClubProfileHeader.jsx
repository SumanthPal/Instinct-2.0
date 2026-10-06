"use client";

import { useState } from "react";
import Image from "next/image";
import { FaInstagram, FaStar, FaRegStar, FaUserCircle } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import {
  extractQuotedContent,
  categoryNames,
  clubAvatarUrl,
  formatCount,
} from "./clubDetailUtils";

function Avatar({ clubData, sizeClass }) {
  const src = clubAvatarUrl(clubData);
  // Track the URL that failed so a different src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState(null);
  const showImg = Boolean(src) && failedSrc !== src;
  return (
    <div className="instinct-story-ring shrink-0">
      <div className="instinct-story-ring-inner">
        <div className={`relative overflow-hidden rounded-full bg-muted ${sizeClass}`}>
          {showImg ? (
            <Image
              src={src}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 76px, 144px"
              unoptimized
              onError={() => setFailedSrc(src)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <FaUserCircle
                className="h-full w-full text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stats({ followers, following }) {
  const items = [
    { label: "followers", value: formatCount(followers) },
    { label: "following", value: formatCount(following) },
  ];
  // Stacked under the number on mobile (IG style), inline on desktop.
  return (
    <ul className="flex justify-around text-center sm:mt-4 sm:justify-start sm:gap-8 sm:text-left">
      {items.map((s) => (
        <li key={s.label} className="flex flex-col text-sm sm:flex-row sm:gap-1">
          <span className="text-base font-semibold tabular-nums sm:text-sm">
            {s.value}
          </span>
          <span className="text-xs text-muted-foreground sm:text-sm">
            {s.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FavoriteButton({ isLiked, isLoading, onToggle, className = "" }) {
  return (
    <Button
      type="button"
      size="sm"
      className={`instinct-btn h-8 gap-1.5 rounded-md px-4 text-xs text-white ${className}`}
      onClick={onToggle}
      disabled={isLoading}
      aria-pressed={isLiked}
      aria-label={isLiked ? "Unfavorite club" : "Favorite club"}
    >
      {isLiked ? (
        <FaStar className="h-3.5 w-3.5" />
      ) : (
        <FaRegStar className="h-3.5 w-3.5" />
      )}
      Favorite
    </Button>
  );
}

function InstagramButton({ handle, className = "" }) {
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={`h-8 rounded-md border-border px-3 text-xs ${className}`}
    >
      <a
        href={`https://instagram.com/${encodeURIComponent(handle || "")}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaInstagram className="h-3.5 w-3.5" />
        Instagram
      </a>
    </Button>
  );
}

/**
 * One DOM tree for both layouts; `.club-profile-header` grid areas in
 * globals.css move the stats and actions between the mobile (IG app) and
 * desktop arrangements, so the avatar and h1 render exactly once.
 */
export default function ClubProfileHeader({
  clubData,
  isLiked,
  isLikeLoading,
  onFavoriteToggle,
}) {
  const handle = clubData?.instagram_handle;
  const cats = categoryNames(clubData?.categories);
  const bio =
    extractQuotedContent(clubData?.description) ||
    clubData?.description ||
    "";

  return (
    <div className="club-profile-header px-4 text-left sm:px-0">
      <div className="[grid-area:avatar] sm:mr-7">
        <Avatar clubData={clubData} sizeClass="h-[76px] w-[76px] sm:h-36 sm:w-36" />
      </div>
      <h1 className="mt-4 text-sm font-semibold text-foreground [grid-area:name] sm:mt-2 sm:self-center sm:text-2xl sm:font-light sm:tracking-tight">
        {clubData?.name}
      </h1>
      <div className="mt-3 flex gap-2 [grid-area:actions] sm:mt-2 sm:self-center">
        <FavoriteButton
          isLiked={isLiked}
          isLoading={isLikeLoading}
          onToggle={onFavoriteToggle}
          className="flex-1 sm:flex-none"
        />
        <InstagramButton handle={handle} />
      </div>
      <div className="self-center [grid-area:stats] sm:self-start">
        <Stats followers={clubData?.followers} following={clubData?.following} />
      </div>
      <p className="font-mono text-xs text-muted-foreground [grid-area:handle] sm:mt-1 sm:text-sm">
        @{handle}
      </p>
      <div className="[grid-area:info]">
        {bio && (
          <p className="mt-2 max-w-md text-sm leading-relaxed text-foreground sm:mt-4">
            {bio}
          </p>
        )}
        {cats.length > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2">
            {cats.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
