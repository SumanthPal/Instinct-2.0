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
      <Navbar />

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pb-14 pt-24 sm:pt-28">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            UC Irvine
          </p>
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Find your <span className="instinct-text">people.</span>
          </h1>

          <div className="relative mt-8 max-w-md">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clubs…"
              className="h-10 rounded-md border-border bg-card pl-9 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setQ(name)}
                className="instinct-chip rounded-md border px-2.5 py-1 text-xs"
              >
                {name}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <Button asChild size="sm" className="instinct-btn rounded-md px-4 text-white">
              <Link href="/clubs">Browse clubs</Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium tracking-tight text-foreground">
                Clubs
              </h2>
              <Button asChild size="sm" variant="outline" className="rounded-md">
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
