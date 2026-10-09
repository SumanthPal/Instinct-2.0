"use client";

import { FiInstagram, FiStar } from "react-icons/fi";
import ClubAvatar from "@/components/ClubAvatar";
import { Button } from "@/components/ui/button";
import ClubLinks from "./ClubLinks";
import ReportLink from "@/components/ReportLink";
import {
  extractQuotedContent,
  categoryNames,
  clubAvatarUrl,
  formatCount,
} from "./clubDetailUtils";
import { linkifyBio, normalizeClubLinks } from "./clubLinkUtils";

function Avatar({ clubData, sizeClass }) {
  return (
    <div className="instinct-story-ring shrink-0">
      <div className="instinct-story-ring-inner">
        <div className={`relative overflow-hidden rounded-full ${sizeClass}`}>
          <ClubAvatar
            src={clubAvatarUrl(clubData)}
            alt=""
            sizes="(max-width: 640px) 76px, 144px"
            priority
            ring={false}
          />
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
      className={`instinct-btn h-8 gap-1.5 rounded-lg px-4 text-xs text-white ${className}`}
      onClick={onToggle}
      disabled={isLoading}
      aria-pressed={isLiked}
      aria-label={isLiked ? "Unfavorite club" : "Favorite club"}
    >
      <FiStar
        className="h-3.5 w-3.5"
        style={{ fill: isLiked ? "currentColor" : "none" }}
        aria-hidden="true"
      />
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
      className={`h-8 rounded-lg border-border px-3 text-xs ${className}`}
    >
      <a
        href={`https://instagram.com/${encodeURIComponent(handle || "")}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FiInstagram className="h-3.5 w-3.5" aria-hidden="true" />
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
  const bioParts = linkifyBio(bio);
  // Links already clickable inline in the bio aren't repeated in the row.
  const inBio = new Set(bioParts.filter((p) => typeof p !== "string").map((p) => p.key));
  const links = normalizeClubLinks(clubData?.club_links).filter((l) => !inBio.has(l.key));

  return (
    <div className="club-profile-header px-4 text-left sm:px-0">
      <div className="[grid-area:avatar] sm:mr-7">
        <Avatar clubData={clubData} sizeClass="h-[76px] w-[76px] sm:h-36 sm:w-36" />
      </div>
      <h1 className="mt-4 text-sm font-semibold text-foreground [grid-area:name] sm:mt-2 sm:text-2xl sm:font-light sm:tracking-tight">
        {clubData?.name}
      </h1>
      <div className="mt-3 flex gap-2 [grid-area:actions] sm:mt-3">
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
      <p className="text-xs text-muted-foreground [grid-area:handle] sm:mt-1 sm:text-sm">
        @{handle}
      </p>
      <div className="[grid-area:info]">
        {bio && (
          <p className="mt-2 max-w-md text-sm leading-relaxed text-foreground sm:mt-4">
            {bioParts.map((part, i) =>
              typeof part === "string" ? (
                part
              ) : (
                <a
                  // biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
                  key={i}
                  href={part.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="instinct-text break-all font-medium hover:underline"
                >
                  {part.text}
                </a>
              ),
            )}
          </p>
        )}
        {links.length > 0 && (
          <div className="mt-1.5 max-w-md sm:mt-2">
            <ClubLinks links={links} handle={handle} />
          </div>
        )}
        {cats.length > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2">
            {cats.join(" · ")}
          </p>
        )}
        {handle && (
          <p className="mt-2">
            <ReportLink club={handle} />
          </p>
        )}
      </div>
    </div>
  );
}
