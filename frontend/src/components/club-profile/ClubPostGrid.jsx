"use client";

import { useState } from "react";
import Image from "next/image";

function PostTile({ post, onImageClick }) {
  const [failed, setFailed] = useState(false);
  const src = post.image_url;
  const showImg = src && !failed;

  return (
    <button
      type="button"
      className="instinct-post-tile relative aspect-square overflow-hidden bg-muted"
      onClick={() => showImg && onImageClick?.(src, post)}
    >
      {showImg ? (
        <Image
          src={src}
          alt=""
          fill
          className="object-cover transition-transform duration-300 hover:scale-105"
          sizes="(max-width: 640px) 33vw, 33vw"
          loading="lazy"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : null}
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
          onImageClick={onImageClick}
        />
      ))}
    </div>
  );
}
