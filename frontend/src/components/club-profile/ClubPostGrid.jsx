"use client";

import { useState } from "react";
import Image from "next/image";
import { FaImage } from "react-icons/fa";

function postLabel(post, index, total) {
  const caption = post.caption?.trim();
  if (caption) {
    const short = caption.length > 80 ? `${caption.slice(0, 80)}…` : caption;
    return `Open post: ${short}`;
  }
  return `Open post ${index + 1} of ${total}`;
}

function PostTile({ post, index, total, onImageClick }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const src = post.image_url;
  const showImg = Boolean(src) && failedSrc !== src;

  // No image: a static placeholder, not an empty button that does nothing.
  if (!showImg) {
    return (
      <div className="instinct-post-tile relative flex aspect-square items-center justify-center bg-muted">
        <FaImage className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Post image unavailable</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="instinct-post-tile relative aspect-square overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onClick={() => onImageClick?.(src, post)}
      aria-label={postLabel(post, index, total)}
    >
      <Image
        src={src}
        alt=""
        fill
        className="object-cover transition-transform duration-300 hover:scale-105"
        sizes="(max-width: 640px) 33vw, 33vw"
        loading="lazy"
        unoptimized
        onError={() => setFailedSrc(src)}
      />
    </button>
  );
}

export default function ClubPostGrid({ posts, onImageClick }) {
  if (!posts?.length) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground sm:px-0">
        No posts available
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
      {posts.map((post, index) => (
        <PostTile
          key={post.id || post.image_url || index}
          post={post}
          index={index}
          total={posts.length}
          onImageClick={onImageClick}
        />
      ))}
    </div>
  );
}
