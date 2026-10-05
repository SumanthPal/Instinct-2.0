"use client";

import Image from "next/image";
import Link from "next/link";
import { extractQuotedContent } from "./clubDetailUtils";

export default function ClubSimilarClubs({ clubs }) {
  if (!clubs?.length) return null;

  return (
    <section className="mt-10 border-t border-border/40 px-4 pt-8 sm:px-0">
      <h2 className="mb-4 text-left text-lg font-semibold tracking-tight text-foreground">
        Similar Clubs
      </h2>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3">
          {clubs.map((club, index) => (
            <Link
              key={club.instagram_handle || index}
              href={`/club/${club.instagram_handle}`}
              className="instinct-card w-44 shrink-0 rounded-xl border border-border bg-card p-3 transition-shadow"
            >
              <div className="mb-2 flex justify-center">
                <div className="relative h-14 w-14 overflow-hidden rounded-full border border-border">
                  {club.profile_image_path ? (
                    <Image
                      src={club.profile_image_path}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-sm font-semibold text-muted-foreground">
                      {club.name?.charAt(0) || "?"}
                    </div>
                  )}
                </div>
              </div>
              <h3 className="line-clamp-2 text-center text-xs font-semibold text-foreground">
                {club.name}
              </h3>
              <p className="mt-0.5 text-center font-mono text-[10px] text-muted-foreground">
                @{club.instagram_handle}
              </p>
              {club.description && (
                <p className="mt-1.5 line-clamp-2 text-center text-[10px] text-muted-foreground">
                  {extractQuotedContent(club.description) || club.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
