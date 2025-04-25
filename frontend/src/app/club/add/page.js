"use client";
import React, { useState } from 'react';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { submitNewClub } from '@/lib/api'; // or wherever
import { useAuth } from '@/context/auth-context'; // Assuming you're using some auth context

const { user } = useAuth(); // user.email should exist if logged in


const ClubForm = () => {
  const [clubName, setClubName] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [categories, setCategories] = useState([]);

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
  

  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">
      <Navbar />
      <main className="container mx-auto px-4 py-24 flex flex-col items-center justify-center text-center">
        <h2 className="text-6xl font-extrabold mb-4 text-gray-900 dark:text-dark-text-white drop-shadow-md">
          Add Your Club
        </h2>
        <p className="text-lg md:text-xl text-gray-700 dark:text-dark-subtext mb-12 max-w-2xl">
          Share your club with the UCI community — help students discover new passions, meet friends, and make memories.
        </p>

        <form onSubmit={handleSubmit} className="bg-white/30 dark:bg-dark-card/30 backdrop-blur-md p-10 rounded-3xl shadow-2xl w-full max-w-3xl">
          {/* Club Name */}
          <div className="mb-8">
            <label htmlFor="clubName" className="block text-left text-lg font-semibold text-gray-900 dark:text-dark-text mb-2">
              Club Name
            </label>
            <p className="text-sm text-gray-600 dark:text-dark-subtext mb-4">
    What's the name of your club? Keep it consistent with what students would recognize.
  </p>
            <input
              type="text"
              id="clubName"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              className="w-full p-4 rounded-xl bg-white/60 dark:bg-dark-profile-card/60 text-gray-800 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-sky-blue dark:focus:ring-dark-subtext transition"
              required
            />
          </div>

          {/* Instagram Handle */}
          <div className="mb-8">
            <label htmlFor="instagram" className="block text-left text-lg font-semibold text-gray-900 dark:text-dark-text mb-2">
              Instagram Handle
            </label>
            <p className="text-sm text-gray-600 dark:text-dark-subtext mb-4">
    Let's get the insta handle. Don't include the @ in the beginning.
  </p>
            <input
              type="text"
              id="instagramHandle"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              className="w-full p-4 rounded-xl bg-white/60 dark:bg-dark-profile-card/60 text-gray-800 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-sky-blue dark:focus:ring-dark-subtext transition"
              required
            />
           
          </div>

          {/* Categories */}
          <div className="mb-8">
            <label htmlFor="categories" className="block text-left text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">
              Categories
            </label>
            <p className="text-sm text-gray-600 dark:text-dark-subtext mb-4">
            Pick the categories that fit your club best — it’ll make it easier for students to discover you!
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-left">
              {categoriesList.map((category) => (
                <label key={category} className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id={category}
                    value={category}
                    onChange={(e) => {
                      const selectedCategories = [...categories];
                      if (e.target.checked) {
                        selectedCategories.push(category);
                      } else {
                        const index = selectedCategories.indexOf(category);
                        selectedCategories.splice(index, 1);
                      }
                      setCategories(selectedCategories);
                    }}
                    className="accent-sky-400 w-5 h-5 rounded-md"
                  />
                  <span className="text-gray-800 dark:text-dark-text">{category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-12">
            <button
              type="submit"
              className="w-full py-4 px-6 bg-gradient-to-r from-sky-blue to-lavender dark:from-dark-profile-card dark:to-dark-subtext text-white font-bold text-xl rounded-2xl hover:scale-105 transition-all duration-300 shadow-lg"
            >
              Submit Club
            </button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default ClubForm;
