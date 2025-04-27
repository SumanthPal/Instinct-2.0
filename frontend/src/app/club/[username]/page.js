import { fetchClubData, fetchClubEvents, fetchClubPosts } from '@/lib/api';
import ClubDetail from '@/components/ClubDetail';
import '../../../../styles/globals.css';
import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';

export default async function ClubPage({ params }) {
  const username = params.username;

  const [clubData, clubPosts, clubEvents] = await Promise.all([
    fetchClubData(username),
    fetchClubPosts(username),
    fetchClubEvents(username),
  ]);
  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue animate-gradientShift bg-[length:200%_200%] dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      <main className="w-full max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center text-center dark:text-dark-text overflow-hidden">
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