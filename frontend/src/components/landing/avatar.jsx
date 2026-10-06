"use client";

import { useState } from "react";
import { FaUserCircle } from "react-icons/fa";

export function Avatar({ src, className = "h-10 w-10" }) {
  // Remember which URL failed so a new src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState(null);
  const showImg = Boolean(src) && failedSrc !== src;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted ${className}`}
    >
      {showImg ? (
        // biome-ignore lint/performance/noImgElement: remote R2 avatars, unoptimized like ClubCard
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <FaUserCircle className="h-full w-full text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  );
}
