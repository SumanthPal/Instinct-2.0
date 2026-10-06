import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import ClubCard from "@/components/ClubCard";
import { Button } from "@/components/ui/button";
import HeroSearch from "@/components/landing/hero-search";
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

// Server component, regenerated at most every 5 minutes (ISR). The data is
// in the HTML, so nothing pops in after hydration and there is no pending
// state to get stuck in.
export const revalidate = 300;

export const metadata = {
  title: "Instinct: UCI club directory",
  description:
    "Search UC Irvine student clubs, see their Instagram posts and upcoming events on one calendar, and star the clubs you care about.",
  alternates: { canonical: "/" },
};

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

// "Today" on campus, independent of the server's timezone.
function campusToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
                // Label first in the DOM (read once as dt), shown under the value.
                <div key={s.label} className="flex flex-col-reverse">
                  <dt className="mt-1 text-xs text-muted-foreground">{s.label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{s.value}</dd>
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

export default async function Home() {
  const todayISO = campusToday();
  // The helpers catch their own errors and return empty results.
  const [manifest, categories, eventsRes] = await Promise.all([
    fetchClubManifest(1, SAMPLE_SIZE),
    fetchCategories(),
    fetchCampusWideEvents(todayISO, null, 6),
  ]);
  const clubs = manifest.results || [];
  const clubCount = manifest.totalCount > 0 ? manifest.totalCount : null;
  const categoryCount = categories?.length || null;
  const events = [...(eventsRes.results || [])].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );

  // A sample: clubs from the first page of /club with a usable bio and
  // categories, ordered by Instagram followers.
  const ranked = clubs
    .filter(
      (c) => cleanDescription(c.description).length > 30 && categoryList(c).length > 0,
    )
    .sort((a, b) => (Number(b.followers) || 0) - (Number(a.followers) || 0));
  const examples = ranked.slice(0, 8);
  const profileClub = ranked[0];
  // Prefer clubs not already shown above; fall back so the preview isn't empty.
  const favoriteClubs = ranked.length > 8 ? ranked.slice(8, 12) : ranked.slice(0, 4);

  const clubStats = [
    clubCount && { label: "clubs listed", value: clubCount.toLocaleString("en-US") },
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
                  <span className="tabular-nums">{clubCount.toLocaleString("en-US")} clubs</span>
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

            <HeroSearch />
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
                  A sample of clubs from the directory, sorted by Instagram followers.
                </p>
              </div>
              <ArrowLink href="/clubs">View all clubs</ArrowLink>
            </div>
            {examples.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Couldn&apos;t load example clubs right now.{" "}
                <Link href="/clubs" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Browse the full directory
                </Link>
                .
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {examples.map((club, i) => (
                  <ClubCard key={club.id} club={toCard(club)} viewMode="grid" index={i} eager />
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
          visual={<EventsPreview events={events} todayISO={todayISO} />}
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
                <div className="mt-auto pt-8">
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
                <div className="mt-auto pt-8">
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
