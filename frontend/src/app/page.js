"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import ClubCard from "@/components/ClubCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  fetchClubManifest,
  fetchCategories,
  fetchCampusWideEvents,
} from "@/lib/api";
import {
  ProfilePreview,
  EventsPreview,
  FavoritesPreview,
  ArrowLink,
  cleanDescription,
  categoryList,
  plainText,
} from "@/components/landing/previews";

const SAMPLE_SIZE = 60;

function toCard(club) {
  return {
    id: club.id,
    profilePicture: club.profile_image_path || club.profile_pic,
    name: plainText(club.name),
    description: cleanDescription(club.description),
    instagram: club.instagram_handle,
    categories: club.categories,
  };
}

function localISODate(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Section({ eyebrow, title, body, actions, visual, stats, flip = false, framed = false }) {
  return (
    <section className="border-t border-border">
      <div
        className={`mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:gap-16 lg:py-28 ${
          flip
            ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
            : "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
        }`}
      >
        <div className={flip ? "lg:order-2" : ""}>
          <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-3 max-w-md text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            {body}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
          {stats?.length > 0 && (
            <dl className="mt-10 flex gap-10">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{s.value}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className={flip ? "lg:order-1" : ""}>
          <div
            className={`flex min-h-[460px] items-center rounded-lg p-6 sm:p-12 ${
              framed ? "bg-[color:var(--accent-brand)]" : "border border-border bg-muted/50"
            }`}
          >
            <div className="w-full">{visual}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [clubs, setClubs] = useState([]);
  const [clubCount, setClubCount] = useState(null);
  const [categoryCount, setCategoryCount] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchClubManifest(1, SAMPLE_SIZE).then((m) => {
      if (cancelled) return;
      setClubs(m.results || []);
      if (m.totalCount > 0) setClubCount(m.totalCount);
    });
    fetchCategories().then((cats) => {
      if (!cancelled && cats?.length) setCategoryCount(cats.length);
    });
    fetchCampusWideEvents(localISODate(), null, 6).then((r) => {
      if (cancelled) return;
      const sorted = [...(r.results || [])].sort((a, b) =>
        String(a.date).localeCompare(String(b.date)),
      );
      setEvents(sorted);
      setEventsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real clubs from the first page of /club, ordered by Instagram followers.
  const ranked = useMemo(
    () =>
      clubs
        .filter(
          (c) => cleanDescription(c.description).length > 30 && categoryList(c).length > 0,
        )
        .sort((a, b) => (Number(b.followers) || 0) - (Number(a.followers) || 0)),
    [clubs],
  );
  const examples = ranked.slice(0, 8);
  const profileClub = ranked[0];
  const favoriteClubs = ranked.slice(8, 12);

  const onSubmit = (e) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/clubs?search=${encodeURIComponent(term)}` : "/clubs");
  };

  const clubStats = [
    clubCount && { label: "clubs listed", value: clubCount.toLocaleString() },
    categoryCount && { label: "categories", value: categoryCount },
  ].filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-32 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:pb-28 lg:pt-40">
          <div>
            <p className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">UC Irvine</span>
              {clubCount && (
                <>
                  <span className="h-3 w-px bg-border" />
                  <span className="tabular-nums">{clubCount.toLocaleString()} clubs</span>
                </>
              )}
            </p>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Find your
              <br />
              people.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Instinct is a directory of UCI student clubs, built from the posts and
              events clubs share on Instagram.
            </p>

            <form onSubmit={onSubmit} className="mt-10 flex max-w-lg gap-2">
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search clubs, e.g. robotics"
                aria-label="Search clubs"
                className="h-11 rounded-md border-border bg-card text-base shadow-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button type="submit" className="instinct-btn h-11 rounded-md px-5 text-white">
                Search
              </Button>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <ArrowLink href="/clubs">Browse all clubs</ArrowLink>
              <Link
                href="/events"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Upcoming events
              </Link>
            </div>
          </div>

          <div className="hidden justify-center lg:flex">
            {/* biome-ignore lint/performance/noImgElement: static brand mark */}
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              className="h-auto w-full max-w-[440px] select-none"
              draggable={false}
            />
          </div>
        </section>

        {/* Example clubs */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="mb-10 flex items-end justify-between gap-6">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Clubs on Instinct
                </h2>
                <p className="mt-2 text-muted-foreground">
                  A few of the clubs in the directory right now.
                </p>
              </div>
              <ArrowLink href="/clubs">View all clubs</ArrowLink>
            </div>
            {examples.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="h-[360px] animate-pulse rounded-md border border-border bg-muted/40" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {examples.map((club, i) => (
                  <ClubCard key={club.id} club={toCard(club)} viewMode="grid" index={i} />
                ))}
              </div>
            )}
          </div>
        </section>

        <Section
          eyebrow="Clubs"
          title="Every club, one profile."
          body="Each club gets a page with its bio, categories, Instagram posts and the events pulled from them."
          actions={
            <>
              <Button asChild className="instinct-btn h-10 rounded-md px-5 text-white">
                <Link href="/clubs">Browse clubs</Link>
              </Button>
              {profileClub && (
                <Button asChild variant="outline" className="h-10 rounded-md px-5">
                  <Link href={`/club/${profileClub.instagram_handle}`}>Open a profile</Link>
                </Button>
              )}
            </>
          }
          stats={clubStats}
          framed
          visual={<ProfilePreview club={profileClub} />}
        />

        <Section
          flip
          eyebrow="Events"
          title="What's happening on campus."
          body="Events are picked out of club posts and put on one calendar, so you can see what's coming up without following every account."
          actions={
            <Button asChild variant="outline" className="h-10 rounded-md px-5">
              <Link href="/events">See upcoming events</Link>
            </Button>
          }
          visual={<EventsPreview events={events} loaded={eventsLoaded} />}
        />

        <Section
          eyebrow="Favorites"
          title="Keep the clubs you care about."
          body="Sign in with your UCI Google account to star clubs. Your favorites stay on your dashboard."
          actions={
            <Button asChild variant="outline" className="h-10 rounded-md px-5">
              <Link href="/clubs">Find clubs to favorite</Link>
            </Button>
          }
          visual={<FavoritesPreview clubs={favoriteClubs} />}
        />

        {/* Get started */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Get started
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="flex flex-col rounded-md border border-border p-8">
                <h3 className="text-xl font-semibold tracking-tight">Looking for a club</h3>
                <p className="mt-2 text-muted-foreground">
                  Search by name or interest and filter by category.
                </p>
                <div className="mt-8">
                  <Button asChild className="instinct-btn h-10 rounded-md px-5 text-white">
                    <Link href="/clubs">Browse clubs</Link>
                  </Button>
                </div>
              </div>
              <div className="flex flex-col rounded-md border border-border p-8">
                <h3 className="text-xl font-semibold tracking-tight">Run a club</h3>
                <p className="mt-2 text-muted-foreground">
                  Not listed yet? Sign in and submit your club's Instagram handle to get
                  it into the directory.
                </p>
                <div className="mt-8">
                  <Button asChild variant="outline" className="h-10 rounded-md px-5">
                    <Link href="/club/add">Add your club</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
