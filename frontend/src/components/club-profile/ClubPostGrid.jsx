"use client";

import { useState } from "react";
import Image from "next/image";
import { FiImage } from "react-icons/fi";
import { cleanCaption } from "./post-viewer/post-utils";

function postLabel(post, index, total, handle) {
  const caption = cleanCaption(post.caption, handle);
  if (caption) {
    const short = caption.length > 80 ? `${caption.slice(0, 80)}…` : caption;
    return `Open post: ${short}`;
  }
  return `Open post ${index + 1} of ${total}`;
}

function PostTile({ post, index, total, handle, onOpen }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const src = post.image_url;
  const showImg = Boolean(src) && failedSrc !== src;
  // A post with no image can still carry a caption or an Instagram link, so
  // it opens the viewer too (which shows a placeholder for the image).
  const openable = showImg || Boolean(post.caption || post.post_url);

  if (!openable) {
    return (
      <div className="instinct-post-tile relative flex aspect-square items-center justify-center bg-muted">
        <FiImage className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Post image unavailable</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="instinct-post-tile relative flex aspect-square items-center justify-center overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onClick={() => onOpen?.(post, index)}
      data-post-tile={post.id}
      aria-label={postLabel(post, index, total, handle)}
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
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <FiImage className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
    </button>
  );
}

export default function ClubPostGrid({
  posts,
  handle,
  onOpen,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  if (!posts?.length) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground sm:px-0">
        No posts available
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
        {posts.map((post, index) => (
          <PostTile
            key={post.id || post.image_url || index}
            post={post}
            index={index}
            total={posts.length}
            handle={handle}
            onOpen={onOpen}
          />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex h-8 items-center rounded-full border border-border px-4 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more posts"}
          </button>
        </div>
      )}
    </>
  );
}
