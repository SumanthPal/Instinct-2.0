import { fetchClubData, fetchClubPosts } from '../../lib/api';
import DarkModeToggle from '../../components/ui/DarkModeToggle';
import ClubDetail from '../../components/ClubDetail';
import '../../../styles/globals.css';
import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';

export async function getServerSideProps(context) {
  const { username } = context.params;
  const [clubData, clubPosts] = await Promise.all([
    fetchClubData(username),
    fetchClubPosts(username)
  ]);

  return {
    props: {
      clubData,
      initialClubPosts: clubPosts // Pass posts as initialClubPosts
    }
  };
}

export default function ClubPage({ clubData, initialClubPosts }) {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue animate-gradientShift bg-[length:200%_200%] dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      <main className="container mx-auto px-4 py-24 flex flex-col items-center justify-center text-center  dark:text-dark-text">
        <ClubDetail clubData={clubData} initialClubPosts={initialClubPosts} />
      </main>
      <Footer />
    </div>
  );
}