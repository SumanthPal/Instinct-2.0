"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FiUser } from "react-icons/fi";

/**
 * Club profile picture that falls back to an outlined person icon in a thin
 * ring when `src` is missing or the image fails to load (most R2 pfps
 * currently 404). Pass `ring={false}` where the parent already draws a ring.
 * Parent must be `position: relative` with an explicit size when using fill.
 *
 * Keyed on `src` so a new URL starts from a clean state instead of resetting
 * `failed` in an effect (which costs a render with the stale fallback).
 */
export default function ClubAvatar(props) {
  return <ClubAvatarImage key={props.src || "none"} {...props} />;
}

function ClubAvatarImage({
  src,
  alt = "",
  className = "object-cover",
  sizes = "80px",
  priority = false,
  fill = true,
  width,
  height,
  onLoad,
  ring = true,
}) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef(null);

  // The server-rendered <img> can finish (or 404) before React attaches
  // onLoad/onError, so check its state once on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth === 0) setFailed(true);
    else onLoad?.();
    // Only on mount: later loads go through the handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!src || failed) {
    return (
      <div
        data-avatar-fallback=""
        className={`flex h-full w-full items-center justify-center rounded-full text-foreground ${
          ring ? "border border-[color:var(--avatar-ring)]" : ""
        }`}
      >
        <FiUser className="h-[46%] w-[46%]" strokeWidth={1.75} aria-hidden="true" />
        {alt && <span className="sr-only">{alt}</span>}
      </div>
    );
  }

  return (
    <Image
      ref={imgRef}
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      sizes={sizes}
      priority={priority}
      unoptimized
      onLoad={() => onLoad?.()}
      onError={() => setFailed(true)}
    />
  );
}
