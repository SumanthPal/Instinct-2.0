"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchClubManifest } from "@/lib/api";

const FEATURES = [
  {
    title: "Browse clubs",
    body: "Search and filter UCI clubs by name or category, with descriptions pulled from their Instagram profiles.",
    href: "/clubs",
  },
  {
    title: "See upcoming events",
    body: "Events are picked out of club posts and collected on one calendar, so you can see what is happening this week.",
    href: "/events",
  },
  {
    title: "Favorite clubs",
    body: "Sign in with your UCI Google account to star clubs and keep them on your dashboard.",
    href: "/clubs",
  },
];

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [clubCount, setClubCount] = useState(null);

  // Real count from the API; the line is hidden if the request fails.
  useEffect(() => {
    let cancelled = false;
    fetchClubManifest(1, 1).then((m) => {
      if (!cancelled && m.totalCount > 0) setClubCount(m.totalCount);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/clubs?search=${encodeURIComponent(term)}` : "/clubs");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-32 sm:pt-40">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            UC Irvine
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Find your people.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Instinct is a directory of UCI student clubs, built from the posts
            and events clubs share on Instagram.
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex max-w-md gap-2">
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clubs…"
              aria-label="Search clubs"
              className="h-10 rounded-md border-border bg-card shadow-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button type="submit" variant="outline" className="h-10 rounded-md">
              Search
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button asChild className="instinct-btn h-10 rounded-md px-5 text-white">
              <Link href="/clubs">Browse clubs</Link>
            </Button>
            <Link
              href="/events"
              className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              See upcoming events →
            </Link>
          </div>

          {clubCount != null && (
            <p className="mt-10 text-sm text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {clubCount.toLocaleString()}
              </span>{" "}
              clubs listed
            </p>
          )}
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-5xl gap-px overflow-hidden px-6 py-16 sm:grid-cols-3 sm:gap-0">
            {FEATURES.map((f, i) => (
              <Link
                key={f.title}
                href={f.href}
                className={`group block border border-border p-6 transition-colors hover:bg-muted/40 ${
                  i > 0 ? "-mt-px sm:-ml-px sm:mt-0" : ""
                } ${i === 0 ? "rounded-t-md sm:rounded-l-md sm:rounded-tr-none" : ""} ${
                  i === FEATURES.length - 1 ? "rounded-b-md sm:rounded-r-md sm:rounded-bl-none" : ""
                }`}
              >
                <h2 className="text-sm font-medium text-foreground">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
