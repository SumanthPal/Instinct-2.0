// src/app/dashboard/page.js
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { likesService } from '@/lib/like-service';
import ClubCard from '@/components/ClubCard';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { useToast } from '@/components/ui/toast'; 
import { useRouter } from 'next/navigation';
import ParallaxBackground from '@/components/ui/ParallaxBackground';


export default function Dashboard() {
  const [likedClubs, setLikedClubs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast(); // now you have access to toast


  // Fetch liked clubs when component mounts
  useEffect(() => {
    const fetchLikedClubs = async () => {
      try {
        if (authLoading) return; // Wait for auth to initialize
        
        // Redirect to login if not authenticated
        if (!user) {
          toast({
            title: "Login Required",
            description: "Please log in to view your dashboard",
            status: "warning",
            duration: 3000,
            isClosable: true,
          });
          router.push('/');
          return;
        }
        
        setIsLoading(true);
        const clubs = await likesService.getLikedClubs();
        console.log('Fetched liked clubs:', clubs);
        
        // Make sure clubs are in the format expected by ClubCard
        const formattedClubs = clubs.map(club => ({
          id: club.id,
          name: club.name || club.club_name,
          description: club.description || club.club_description,
          instagram: club.instagram || club.instagram_handle,
          profilePicture: club.profilePicture || club.profile_picture || club.club_profile_pic,
          categories: Array.isArray(club.categories) 
            ? club.categories 
            : (typeof club.categories === 'string' 
                ? club.categories.split(',').map(cat => ({ name: cat.trim() }))
                : [])
        }));
        
        console.log('Formatted clubs for display:', formattedClubs);
        setLikedClubs(formattedClubs);
      } catch (error) {
        console.error('Error fetching liked clubs:', error);
        toast({
          title: "Error",
          description: "Failed to load your favorites. Please try again later.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLikedClubs();
  }, [user, authLoading, router]);

  // Handle unlike directly from dashboard
  const handleUnlike = async (instagramHandle) => {
    if (!instagramHandle) {
      console.error('Missing instagram handle for unlike operation');
      return;
    }
    
    try {
      // Use the toggleLikeClub method to unlike
      await likesService.toggleLikeClub(instagramHandle);
      
      // Remove from the list using instagram handle
      setLikedClubs(prev => prev.filter(club => club.instagram !== instagramHandle));
      
      toast({
        title: "Club Removed",
        description: "Club has been removed from your favorites",
        status: "info",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error unliking club:', error);
      toast({
        title: "Error",
        description: "Failed to remove club from favorites",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <div>
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <ParallaxBackground />
      </div>
      
      <Navbar />
      
      <main className="w-full px-4 py-8 flex flex-col items-center justify-center text-center z-10 relative">
        <div className="hero min-h-[20vh] flex flex-col items-center justify-center z-10 mb-20">
          <div className="flex items-center justify-center space-x-4 mb-6 mt-12">
  <h1
    className="font-bold text-gray-900 dark:text-white"
    style={{
      fontSize: "clamp(2rem, 5vw, 3rem)",
    }}
  >
    Your Favorite Clubs
  </h1>
</div>
          
          <h2 className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-8">
            {user ? `Welcome back, ${user.email?.split('@')[0] || 'User'}!` : 'Please log in to view your favorites'}
          </h2>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-center items-center h-64 w-full">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-900 dark:border-gray-200"></div>
          </div>
        )}

        {/* No liked clubs message */}
        {/* No liked clubs or not logged in */}
        {!isLoading && likedClubs.length === 0 && (
  <div className="w-full flex flex-col items-center justify-center py-24 px-6 space-y-8">
    <h2 className="text-5xl font-bold text-gray-900 dark:text-dark-text">
      {user ? 'No Favorite Clubs Yet' : 'Welcome to Instinct'}
    </h2>
    <p className="text-2xl text-gray-700 dark:text-dark-subtext max-w-2xl">
      {user
        ? 'Start exploring UCI clubs and add them to your favorites by clicking the star icon!'
        : 'Please sign in to explore and save your favorite clubs across campus.'}
    </p>
    <button
      onClick={() => router.push(user ? '/clubs' : '/')}
      className="px-8 py-4 bg-purple-300 hover:bg-purple-500 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-2xl rounded-full transition-all duration-300"
    >
      {user ? 'Explore Clubs' : 'Return Home'}
    </button>
  </div>
)}


        {/* Club Cards Grid */}
        {!isLoading && likedClubs.length > 0 && (
          <div 
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 
                      w-full max-w-7xl px-4 sm:px-6 mb-12"
          >
            {likedClubs.map((club) => (
              <ClubCard
                key={club.id || club.instagram}
                club={club}
              />
            ))}
          </div>
        )}
      </main>

      </div>
      <Footer />

      </div>
  );
}