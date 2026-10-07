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

export default function Dashboard() {
  const [likedClubs, setLikedClubs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [activeFilter, setActiveFilter] = useState('all');

  // Fetch liked clubs when component mounts
  useEffect(() => {
    const fetchLikedClubs = async () => {
      try {
        if (authLoading) return;
        
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

  // Extract unique categories from clubs for filtering
  const uniqueCategories = [...new Set(
    likedClubs.flatMap(club => 
      club.categories.map(cat => 
        typeof cat === 'string' ? cat : cat.name
      )
    )
  )];

  // Filter clubs based on active filter
  const filteredClubs = activeFilter === 'all' 
    ? likedClubs 
    : likedClubs.filter(club => 
        club.categories.some(cat => 
          (typeof cat === 'string' ? cat : cat.name) === activeFilter
        )
      );

  // Handle unlike
  const handleUnlike = async (instagramHandle) => {
    if (!instagramHandle) {
      console.error('Missing instagram handle for unlike operation');
      return;
    }
    
    try {
      await likesService.toggleLikeClub(instagramHandle);
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

  const chip = (active) =>
    `instinct-chip shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active ? 'instinct-chip-active' : ''
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-[112px] sm:px-6 sm:pt-[120px] md:pb-20">
        <div className="mb-8">
          <h1 className="instinct-heading text-3xl font-semibold tracking-tight text-foreground">
            Favorites
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user ? `Welcome back, ${user.email?.split('@')[0] || 'User'}.` : 'Please log in to view your favorites.'}
          </p>
        </div>

        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              aria-pressed={activeFilter === 'all'}
              className={chip(activeFilter === 'all')}
            >
              All
            </button>
            {uniqueCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveFilter(category)}
                aria-pressed={category === activeFilter}
                className={chip(category === activeFilter)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <section>
          <h2 className="sr-only">
            {activeFilter === 'all' ? 'All favorite clubs' : activeFilter}
          </h2>

          {isLoading && (
            <div className="flex h-64 w-full items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-foreground motion-reduce:animate-none" />
            </div>
          )}

          {!isLoading && filteredClubs.length === 0 && (
            <div className="flex w-full flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center">
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                {activeFilter !== 'all'
                  ? `No ${activeFilter} clubs found`
                  : (user ? 'No favorite clubs yet' : 'Welcome to Instinct')}
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {activeFilter !== 'all'
                  ? `You don't have any ${activeFilter} clubs in your favorites yet.`
                  : (user
                    ? 'Explore UCI clubs and add them to your favorites with the star on each card.'
                    : 'Please sign in to explore and save your favorite clubs across campus.')}
              </p>
              <button
                type="button"
                onClick={() => router.push(user ? '/clubs' : '/')}
                className="instinct-btn mt-6 rounded-full px-5 py-2 text-sm font-medium text-white"
              >
                {user ? 'Explore clubs' : 'Return home'}
              </button>
            </div>
          )}

          {!isLoading && filteredClubs.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClubs.map((club, index) => (
                <div key={club.id || club.instagram} className="h-full">
                  <ClubCard club={club} index={index} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
