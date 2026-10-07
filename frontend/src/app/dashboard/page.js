// src/app/dashboard/page.js
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import { Skeleton } from '@/components/dashboard/parts';
import { toCard, useDashboardData } from '@/components/dashboard/useDashboardData';
import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { likesService } from '@/lib/like-service';

export default function Dashboard() {
  const [likedClubs, setLikedClubs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      toast({ title: 'Login Required', description: 'Please log in to view your dashboard', status: 'warning', duration: 3000, isClosable: true });
      router.push('/');
      return;
    }
    let live = true;
    setIsLoading(true);
    likesService
      .getLikedClubs()
      .then((clubs) => {
        if (!live) return;
        setLikedClubs(
          clubs.map((club) =>
            toCard({
              ...club,
              categories: Array.isArray(club.categories)
                ? club.categories
                : typeof club.categories === 'string'
                  ? club.categories.split(',').map((cat) => ({ name: cat.trim() }))
                  : [],
            }),
          ),
        );
      })
      .catch(() => {
        if (live) toast({ title: 'Error', description: 'Failed to load your favorites. Please try again later.', status: 'error', duration: 3000, isClosable: true });
      })
      .finally(() => live && setIsLoading(false));
    return () => {
      live = false;
    };
  }, [user, authLoading, router]); // eslint-disable-line

  // Unstarring from a card drops it from the list right away.
  const onUnstar = useCallback((handle) => setLikedClubs((prev) => prev.filter((c) => c.instagram !== handle)), []);
  const now = useMemo(() => new Date(), []);
  const data = useDashboardData(isLoading ? [] : likedClubs, now);
  const name = user?.email?.split('@')[0];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-[104px] sm:px-6 sm:pt-[112px] md:pb-20">
        {isLoading ? <Skeleton className="h-96" /> : <DashboardTabs name={name} clubs={likedClubs} data={data} now={now} onUnstar={onUnstar} />}
      </main>
      <Footer />
    </div>
  );
}
