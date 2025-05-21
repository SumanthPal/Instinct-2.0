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
  
  // Add view mode state like in the news page
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
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

  // Category emoji mapping similar to news page
  const categoryEmojis = {
    'Sports': '🏀',
    'Academic': '📚',
    'Arts': '🎨',
    'Cultural': '🌍',
    'Professional': '💼',
    'Social': '👥',
    'Technology': '💻',
    'Service': '🤝',
    'Religious': '🙏',
    'Greek Life': '🏛️',
    'Political': '🗣️',
    'Environmental': '🌱',
    'Health': '🩺',
    'All': '⭐'
  };

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      
      <main className="container mx-auto px-4 py-16 sm:py-20 text-center">
        {/* Heading */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-3 text-dark-base dark:text-white">
            YOUR FAVORITES
          </h1>
          <p className="text-dark-base dark:text-dark-subtext text-lg">
            {user ? `Welcome back, ${user.email?.split('@')[0] || 'User'}!` : 'Please log in to view your favorites'}
          </p>
        </div>

        {/* View Toggle - Similar to news page */}
        <div className="flex justify-end mb-6">
          <div className="inline-flex backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-lg p-1 border border-white/20 dark:border-dark-text/10">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white' : 'text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10'}`}
              aria-label="Grid view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white' : 'text-dark-base dark:text-dark-text hover:bg-white/20 dark:hover:bg-dark-text/10'}`}
              aria-label="List view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Category Pills with Emojis - Similar to news page */}
        <div className="flex flex-wrap justify-center gap-2 mb-12 max-w-4xl mx-auto">
          <button
            key="all"
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeFilter === 'all'
                ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                : 'bg-white/30 dark:bg-dark-card/30 text-dark-base dark:text-dark-text hover:bg-white/50 dark:hover:bg-dark-card/50'
            }`}
          >
            <span className="mr-1">{categoryEmojis['All'] || '⭐'}</span> All Clubs
          </button>
          
          {uniqueCategories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveFilter(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                category === activeFilter
                  ? 'bg-lavender dark:bg-dark-gradient-start text-dark-base dark:text-dark-text-white shadow-md'
                  : 'bg-white/30 dark:bg-dark-card/30 text-dark-base dark:text-dark-text hover:bg-white/50 dark:hover:bg-dark-card/50'
              }`}
            >
              <span className="mr-1">{categoryEmojis[category] || '📄'}</span> {category}
            </button>
          ))}
        </div>

        {/* Main Content Section */}
        <section className="mb-20">
          <div className="flex items-center justify-center mb-8">
            <div className="h-px bg-gradient-to-r from-transparent via-lavender dark:via-dark-gradient-start to-transparent w-16 mr-4"></div>
            <h2 className="text-3xl font-bold text-dark-base dark:text-white flex items-center">
              <span className="mr-2">{categoryEmojis[activeFilter] || '⭐'}</span>
              {activeFilter === 'all' ? 'All Favorite Clubs' : activeFilter}
            </h2>
            <div className="h-px bg-gradient-to-r from-lavender dark:from-dark-gradient-start via-sky-blue dark:via-dark-gradient-end to-transparent w-16 ml-4"></div>
          </div>
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-center items-center h-64 w-full">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-900 dark:border-gray-200"></div>
            </div>
          )}

          {/* No liked clubs message - With glass-effect styling */}
          {!isLoading && filteredClubs.length === 0 && (
            <div className="w-full flex flex-col items-center justify-center py-12 px-6 space-y-8 backdrop-blur-sm bg-white/20 dark:bg-dark-card/20 rounded-xl border border-white/20 dark:border-dark-text/10 shadow-lg">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-dark-text">
                {activeFilter !== 'all' 
                  ? `No ${activeFilter} Clubs Found` 
                  : (user ? 'No Favorite Clubs Yet' : 'Welcome to Instinct')}
              </h2>
              <p className="text-xl text-gray-700 dark:text-dark-subtext max-w-2xl">
                {activeFilter !== 'all' 
                  ? `You don't have any ${activeFilter} clubs in your favorites yet.`
                  : (user
                    ? 'Start exploring UCI clubs and add them to your favorites by clicking the star icon!'
                    : 'Please sign in to explore and save your favorite clubs across campus.')}
              </p>
              <button
                onClick={() => router.push(user ? '/clubs' : '/')}
                className="px-8 py-4 bg-lavender hover:bg-purple-500 dark:bg-dark-gradient-start dark:hover:bg-indigo-600 text-dark-base dark:text-white text-lg rounded-full transition-all duration-300 shadow-md"
              >
                {user ? 'Explore Clubs' : 'Return Home'}
              </button>
            </div>
          )}

          {/* Club Cards - Adapted for list/grid view like news page */}
          {!isLoading && filteredClubs.length > 0 && (
            <div className={`
              ${viewMode === 'grid' 
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl' 
                : 'flex flex-col space-y-6 max-w-3xl'} 
              mx-auto fade-in
            `}>
              {filteredClubs.map((club) => (
                <div key={club.id || club.instagram} className={`
                  backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 
                  rounded-xl border border-white/20 dark:border-dark-text/10 
                  shadow-lg overflow-hidden transition-all duration-300
                  ${viewMode === 'list' ? 'w-full' : ''}
                  hover:shadow-xl hover:scale-[1.02]
                `}>
                  <ClubCard
                    club={club}
                    viewMode={viewMode} // Pass view mode to ClubCard if it supports different layouts
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      
      <Footer />

      {/* Add custom CSS for animations - Same as news page */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}