"use client";

import Image from "next/image";

export default function ClubImageModal({
  open,
  imageUrl,
  imageData,
  onClose,
}) {
  if (!open || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative mx-auto w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 rounded-md bg-black/50 p-2 text-white/90 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="relative aspect-square w-full overflow-hidden rounded-t-lg bg-black">
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-contain"
            sizes="512px"
            priority
            unoptimized
          />
        </div>
        {imageData?.caption && (
          <div className="max-h-40 overflow-y-auto rounded-b-lg bg-card p-4 text-left">
            <p className="text-sm leading-relaxed text-foreground">
              {imageData.caption}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
