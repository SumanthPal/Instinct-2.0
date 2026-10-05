"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { FaUserCircle } from "react-icons/fa";

/**
 * Club profile picture that falls back to FaUserCircle when `src` is missing
 * or the image fails to load (most R2 pfps currently 404).
 * Parent must be `position: relative` with an explicit size when using fill.
 */
export default function ClubAvatar({
  src,
  alt = "",
  className = "object-cover",
  sizes = "80px",
  priority = false,
  fill = true,
  width,
  height,
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="w-full h-full bg-light-gray flex items-center justify-center dark:bg-gray-700">
        <FaUserCircle className="text-gray-500 w-full h-full" aria-hidden="true" />
        <span className="sr-only">{alt || "Club avatar unavailable"}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      sizes={sizes}
      priority={priority}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
