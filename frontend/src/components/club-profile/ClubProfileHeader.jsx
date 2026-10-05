"use client";

import { useState } from "react";
import Image from "next/image";
import { FaInstagram, FaStar, FaRegStar, FaUserCircle } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import {
  extractQuotedContent,
  categoryNames,
  clubAvatarUrl,
} from "./clubDetailUtils";

function Avatar({ clubData, sizeClass }) {
  const src = clubAvatarUrl(clubData);
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
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
              sizes="144px"
              unoptimized
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <FaUserCircle
                className="h-full w-full text-muted-foreground"
                aria-hidden="true"
              />
              <span className="sr-only">{clubData?.name || "Club avatar"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stats({ postCount, followers, following, stacked }) {
  const items = [
    { label: "posts", value: postCount },
    { label: "followers", value: followers ?? "—" },
    { label: "following", value: following ?? "—" },
  ];
  if (stacked) {
    return (
      <div className="flex flex-1 justify-around text-center">
        {items.map((s) => (
          <div key={s.label}>
            <p className="text-base font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-5 flex gap-8 text-sm">
      {items.map((s) => (
        <p key={s.label}>
          <span className="font-semibold tabular-nums">{s.value}</span>{" "}
          <span className="text-muted-foreground">{s.label}</span>
        </p>
      ))}
    </div>
  );
}

function FavoriteButton({ isLiked, isLoading, onToggle, className = "" }) {
  return (
    <Button
      type="button"
      size="sm"
      className={`instinct-btn h-8 gap-1.5 rounded-lg px-4 text-xs text-white ${className}`}
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
      className={`h-8 rounded-lg border-border/50 px-3 text-xs ${className}`}
    >
      <a
        href={`https://instagram.com/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaInstagram className="h-3.5 w-3.5" />
        Instagram
      </a>
    </Button>
  );
}

export default function ClubProfileHeader({
  clubData,
  postCount,
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
    <div className="px-4 sm:px-0">
      {/* Mobile */}
      <div className="flex items-center gap-6 sm:hidden">
        <Avatar clubData={clubData} sizeClass="h-[76px] w-[76px]" />
        <Stats
          postCount={postCount}
          followers={clubData?.followers}
          following={clubData?.following}
          stacked
        />
      </div>

      {/* Desktop */}
      <div className="hidden gap-10 sm:flex sm:items-start">
        <Avatar clubData={clubData} sizeClass="h-36 w-36" />
        <div className="min-w-0 flex-1 pt-2 text-left">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-light tracking-tight text-foreground">
              {clubData?.name}
            </h1>
            <FavoriteButton
              isLiked={isLiked}
              isLoading={isLikeLoading}
              onToggle={onFavoriteToggle}
            />
            <InstagramButton handle={handle} />
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            @{handle}
          </p>
          <Stats
            postCount={postCount}
            followers={clubData?.followers}
            following={clubData?.following}
          />
          {bio && (
            <p className="mt-4 max-w-md text-sm leading-relaxed text-foreground">
              {bio}
            </p>
          )}
          {cats.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {cats.join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Mobile bio / actions */}
      <div className="mt-4 text-left sm:hidden">
        <h1 className="text-sm font-semibold text-foreground">
          {clubData?.name}
        </h1>
        <p className="font-mono text-xs text-muted-foreground">@{handle}</p>
        {bio && (
          <p className="mt-2 text-sm leading-relaxed text-foreground">{bio}</p>
        )}
        {cats.length > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {cats.join(" · ")}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <FavoriteButton
            isLiked={isLiked}
            isLoading={isLikeLoading}
            onToggle={onFavoriteToggle}
            className="flex-1"
          />
          <InstagramButton handle={handle} />
        </div>
      </div>
    </div>
  );
}
