import { notFound } from "next/navigation";
import { fetchClubData, fetchClubEvents, fetchClubPosts } from "@/lib/api";
import ClubDetail from "@/components/ClubDetail";
import "../../../../styles/globals.css";
import Footer from "@/components/ui/Footer";
import Navbar from "@/components/ui/Navbar";

const EMPTY_LIST = { results: [], hasMore: false, page: 1, totalPages: 1 };

export default async function ClubPage({ params, searchParams }) {
  const { username } = await params;
  const { tab } = (await searchParams) || {};

  // Posts and events are optional: a failure there shows an empty tab
  // instead of taking down the whole profile.
  const [clubResult, postsResult, eventsResult] = await Promise.allSettled([
    fetchClubData(username),
    fetchClubPosts(username),
    fetchClubEvents(username),
  ]);

  if (clubResult.status === "rejected") {
    if (clubResult.reason?.status === 404) notFound();
    throw clubResult.reason;
  }
  const clubData = clubResult.value;
  const clubPosts = postsResult.status === "fulfilled" ? postsResult.value : EMPTY_LIST;
  const clubEvents = eventsResult.status === "fulfilled" ? eventsResult.value : EMPTY_LIST;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-0 pb-10 pt-[88px] sm:px-4 sm:pt-[100px]">
        <ClubDetail
          key={clubData?.instagram_handle || username}
          clubData={clubData}
          initialClubPosts={clubPosts}
          initialClubEvents={clubEvents}
          initialTab={tab === "events" ? "events" : "posts"}
        />
      </main>
      <Footer />
    </div>
  );
}
