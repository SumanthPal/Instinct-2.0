"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { FaExternalLinkAlt, FaTimes } from "react-icons/fa";
import { parseLocalDate, safeHttpUrl } from "./clubDetailUtils";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function ClubImageModal({
  open,
  imageUrl,
  imageData,
  onClose,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const isOpen = Boolean(open && imageUrl);
  // Keep the latest onClose without re-running the focus effect each render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus in, trap Tab, close on Escape, lock scroll, restore focus on close.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const postUrl = safeHttpUrl(imageData?.post_url);
  const posted = parseLocalDate(imageData?.posted);
  const title =
    imageData?.parsed?.Name || imageData?.name || (posted ? `Post from ${format(posted, "MMM d, yyyy")}` : "Post");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-image-modal-title"
        className="relative mx-auto w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="club-image-modal-title" className="sr-only">
          {title}
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 rounded-md bg-black/50 p-2 text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Close"
        >
          <FaTimes className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="relative aspect-square w-full overflow-hidden rounded-t-lg bg-black">
          <Image
            src={imageUrl}
            alt={imageData?.caption ? imageData.caption.slice(0, 120) : ""}
            fill
            className="object-contain"
            sizes="512px"
            priority
            unoptimized
          />
        </div>
        <div className="max-h-48 overflow-y-auto rounded-b-lg bg-card p-4 text-left">
          {imageData?.caption && (
            <p className="text-sm leading-relaxed text-foreground">
              {imageData.caption}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            {posted && <span>{format(posted, "MMM d, yyyy")}</span>}
            {postUrl && (
              <a
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
              >
                View on Instagram
                <FaExternalLinkAlt className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
