import { fetchClubData, fetchClubEvents, fetchClubPosts } from "@/lib/api";
import ClubDetail from "@/components/ClubDetail";
import "../../../../styles/globals.css";
import Footer from "@/components/ui/Footer";
import Navbar from "@/components/ui/Navbar";

export default async function ClubPage({ params }) {
  const { username } = await params;

  const [clubData, clubPosts, clubEvents] = await Promise.all([
    fetchClubData(username),
    fetchClubPosts(username),
    fetchClubEvents(username),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-0 pb-10 pt-[88px] sm:px-4 sm:pt-[100px]">
        <ClubDetail
          clubData={clubData}
          initialClubPosts={clubPosts}
          initialClubEvents={clubEvents}
        />
      </main>
      <Footer />
    </div>
  );
}
