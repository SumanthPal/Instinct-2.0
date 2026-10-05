"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import ClubCard from "@/components/ClubCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchClubManifest, fetchCategories } from "@/lib/api";
import { FaSearch } from "react-icons/fa";

const FALLBACK_CHIPS = ["Technology", "Cultural and Social", "Career and Professional", "Fitness"];

function mapClub(club) {
  return {
    id: club.id,
    profilePicture: club.profile_image_path || club.profile_pic,
    name: club.name,
    description: club.description,
    instagram: club.instagram_handle,
    categories: club.categories,
  };
}

export default function Home() {
  const [q, setQ] = useState("");
  const [clubs, setClubs] = useState([]);
  const [chips, setChips] = useState(FALLBACK_CHIPS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [manifest, cats] = await Promise.all([
        fetchClubManifest(1, 24),
        fetchCategories(),
      ]);
      if (cancelled) return;
      setClubs(manifest.results || []);
      if (cats?.length) {
        // Prefer a few recognizable chips that exist in the API list
        const preferred = [
          "Technology",
          "Cultural and Social",
          "Career and Professional",
          "Fitness",
          "Community Service",
          "Academics and Honors",
        ];
        const set = new Set(cats);
        const picked = preferred.filter((n) => set.has(n)).slice(0, 4);
        setChips(picked.length ? picked : cats.slice(0, 4));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = !needle
      ? clubs
      : clubs.filter(
          (c) =>
            c.name?.toLowerCase().includes(needle) ||
            c.instagram_handle?.toLowerCase().includes(needle) ||
            (c.categories || []).some((cat) =>
              (cat.name || cat).toLowerCase().includes(needle),
            ),
        );
    return list.slice(0, 6);
  }, [clubs, q]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="instinct-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--instinct-pink)" />
            <stop offset="50%" stopColor="var(--instinct-purple)" />
            <stop offset="100%" stopColor="var(--instinct-sky)" />
          </linearGradient>
        </defs>
      </svg>

      <Navbar />

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-28 sm:pt-32">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            UC Irvine
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.08]">
            Find your <span className="instinct-text">people.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            Discover campus clubs with a quieter UI — Instinct accents, same
            cards.
          </p>

          <div className="relative mt-10 max-w-xl">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clubs…"
              className="h-11 rounded-lg border-border bg-card pl-10 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setQ(name)}
                className="instinct-chip rounded-full border px-3 py-1 text-xs"
              >
                {name}
              </button>
            ))}
          </div>

          <div className="mt-8">
            <Button asChild size="sm" className="instinct-btn rounded-full px-5 text-white">
              <Link href="/clubs">Browse clubs</Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border bg-card/30">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Clubs
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Featured clubs</p>
              </div>
              <Button asChild size="sm" className="instinct-btn rounded-full text-white">
                <Link href="/clubs">View all</Link>
              </Button>
            </div>

            {preview.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {clubs.length === 0 ? "Loading clubs…" : "No clubs match that search."}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {preview.map((club, i) => (
                  <ClubCard
                    key={club.id || club.instagram_handle || i}
                    club={mapClub(club)}
                    viewMode="grid"
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
