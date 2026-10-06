"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { submitNewClub } from '@/lib/api'; // or wherever
import { useAuth } from '@/context/auth-context'; // Assuming you're using some auth context
import { useToast } from '@/components/ui/toast';



const ClubForm = () => {
  const [clubName, setClubName] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [categories, setCategories] = useState([]);
  const { user, loading: authLoading } = useAuth(); // user.email should exist if logged in
  const router = useRouter();
  const { toast } = useToast();
  const redirected = useRef(false);

  // Same client-side gate as /dashboard: signed-out visitors get a toast and
  // go back home (the server-side proxy.js gate was removed in #100).
  useEffect(() => {
    if (authLoading || user || redirected.current) return;
    redirected.current = true;
    toast({
      title: "Login Required",
      description: "Please log in to add your club",
      status: "warning",
      duration: 3000,
      isClosable: true,
    });
    router.push('/');
  }, [user, authLoading, router, toast]);


  const categoriesList = [
    'Diversity and Inclusion',
    'Greek Life',
    'International',
    'Peer Support',
    'Fitness',
    'Hobbies and Interest',
    'Religious and Spiritual',
    'Cultural and Social',
    'Technology',
    'Graduate',
    'Performance and Entertainment',
    'Career and Professional',
    'LGBTQ',
    'Academics and Honors',
    'Media',
    'Political',
    'Education',
    'Environmental',
    'Community Service',
    'Networking'
  ];

  
const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user?.email) {
      alert('You must be logged in to submit a club.');
      return;
    }
  
    try {
      const newClubData = {
        club_name: clubName,
        instagram_handle: instagramHandle,
        categories: categories,
        submitted_by_email: user.email
      };
  
      const result = await submitNewClub(newClubData);
      console.log('Club successfully added:', result);
  
      setClubName('');
      setInstagramHandle('');
      setCategories([]);
      alert('Club submitted successfully!');
  
    } catch (error) {
      console.error('Failed to submit club:', error);
      alert('Error submitting club. Please try again.');
    }
  };
  

  // Don't show the form while auth resolves or while redirecting.
  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1" aria-busy="true" />
        <Footer />
      </div>
    );
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-hidden transition-colors placeholder:text-muted-foreground focus-visible:border-[color:var(--accent-brand)] focus-visible:ring-2 focus-visible:ring-ring/40";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-[112px] sm:px-6 sm:pt-[120px]">
        <h1 className="instinct-heading text-3xl font-semibold tracking-tight text-foreground">
          Add your club
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Share your club with the UCI community. Help students discover new passions, meet friends, and make memories.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="mb-6">
            <label htmlFor="clubName" className="block text-sm font-medium text-foreground">
              Club name
            </label>
            <p className="mb-2 mt-1 text-xs text-muted-foreground">
              Keep it consistent with what students would recognize.
            </p>
            <input
              type="text"
              id="clubName"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="instagramHandle" className="block text-sm font-medium text-foreground">
              Instagram handle
            </label>
            <p className="mb-2 mt-1 text-xs text-muted-foreground">
              Don&apos;t include the @ at the beginning.
            </p>
            <input
              type="text"
              id="instagramHandle"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <fieldset className="mb-8">
            <legend className="block text-sm font-medium text-foreground">Categories</legend>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Pick the categories that fit your club best so students can find you.
            </p>
            <div className="flex flex-wrap gap-2">
              {categoriesList.map((category) => {
                const checked = categories.includes(category);
                return (
                  <label
                    key={category}
                    className={`instinct-chip inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                      checked ? 'instinct-chip-active' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      value={category}
                      checked={checked}
                      onChange={(e) => {
                        setCategories((prev) =>
                          e.target.checked
                            ? [...prev, category]
                            : prev.filter((c) => c !== category),
                        );
                      }}
                      className="sr-only"
                    />
                    {category}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <button
            type="submit"
            className="instinct-btn h-10 w-full rounded-full px-5 text-sm font-medium text-white sm:w-auto"
          >
            Submit club
          </button>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default ClubForm;
