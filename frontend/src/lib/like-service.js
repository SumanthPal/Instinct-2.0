// src/lib/like-service.js (note the singular name to match your import)
'use client'

import { createClient } from '@/lib/supabase';

export const likesService = {
  /**
   * Get all clubs liked by the current user
   */
  // Updated getLikedClubs method for like-service.js
async getLikedClubs() {
  const supabase = createClient();
  
  try {
    // Check for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to view liked clubs');
    }
    
    // Get user's liked clubs
    const { data: likedData, error: likedError } = await supabase
      .from('user_liked_clubs')
      .select(`
        instagram_handle,
        created_at
      `)
      .eq('user_id', session.user.id);
    
    if (likedError) throw likedError;
    
    if (!likedData || likedData.length === 0) return [];
    
    // Get the full club details for each liked club using instagram handles
    const instagramHandles = likedData.map(item => item.instagram_handle);
    
    // Select all columns from clubs table for the liked clubs
    const { data: clubsData, error: clubsError } = await supabase
      .from('clubs')
      .select('*')
      .in('instagram_handle', instagramHandles);
    
    if (clubsError) throw clubsError;
    
    console.log('Raw club data:', clubsData);
    
    // Map the clubs data to the format expected by the ClubCard component
    return clubsData.map(club => {
      const likeInfo = likedData.find(item => item.instagram_handle === club.instagram_handle);
      
      // Determine which profile picture field to use
      
      const profilePicture = "https://instinctucistorage.blob.core.windows.net/images/"  + club.profile_image_path 
      
      // Extract categories from club_links if available
      let categories = [];
      if (club.club_links && Array.isArray(club.club_links)) {
        // Assuming club_links might contain category information
        // This is a placeholder - adjust based on your actual data structure
        categories = club.club_links
          .filter(link => link && link.category)
          .map(link => ({ name: link.category }));
      }
      
      return {
        id: club.id,
        name: club.name,
        description: club.description || '',
        instagram: club.instagram_handle,
        profilePicture: profilePicture,
        categories: categories,
        followers: club.followers,
        following: club.following,
        liked_at: likeInfo?.created_at
      };
    });
  } catch (error) {
    console.error('Error fetching liked clubs:', error);
    return [];
  }
},
  
  /**
   * Check if a club is liked by the current user
   */
  async isClubLiked(instagramHandle) {
    if (!instagramHandle) {
      console.warn('No instagram handle provided to isClubLiked');
      return false;
    }
    
    const handle = typeof instagramHandle === 'object' ? 
      instagramHandle.instagram : instagramHandle;
    
    if (!handle) {
      console.warn('Could not determine instagram handle from:', instagramHandle);
      return false;
    }
    
    const supabase = createClient();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      
      console.log('Checking if club is liked:', {
        userId: session.user.id,
        instagramHandle: handle
      });
      
      const { data, error } = await supabase
        .from('user_liked_clubs')
        .select('instagram_handle')
        .eq('user_id', session.user.id)
        .eq('instagram_handle', handle)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking if club is liked:', error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error('Error checking if club is liked:', error);
      return false;
    }
  },
  
  /**
   * Toggle like status for a club
   */
  async toggleLikeClub(instagramHandle) {
    let handle = instagramHandle;
    
    if (typeof instagramHandle === 'object') {
      handle = instagramHandle.instagram || instagramHandle.instagram_handle;
    }
    
    if (!handle) {
      console.error('Instagram handle is missing for toggleLikeClub. Received:', instagramHandle);
      throw new Error('Instagram handle is required');
    }
    
    console.log('Toggling like for Instagram handle:', handle);
    
    const supabase = createClient();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to like/unlike clubs');
      }
      
      // Check if already liked
      const isLiked = await this.isClubLiked(handle);
      console.log('Current like status:', isLiked);
      
      if (isLiked) {
        // Unlike the club
        console.log('Unliking club...');
        const { error } = await supabase
          .from('user_liked_clubs')
          .delete()
          .eq('user_id', session.user.id)
          .eq('instagram_handle', handle);
        
        if (error) {
          console.error('Error unliking club:', error);
          throw error;
        }
        
        return false; // Now unliked
      } else {
        // Like the club
        console.log('Liking club...', {
          user_id: session.user.id,
          instagram_handle: handle
        });
        
        const { data, error } = await supabase
          .from('user_liked_clubs')
          .insert({
            user_id: session.user.id,
            instagram_handle: handle
          })
          .select();
        
        if (error) {
          console.error('Error liking club:', error);
          throw error;
        }
        
        console.log('Like successful:', data);
        return true; // Now liked
      }
    } catch (error) {
      console.error('Error toggling club like:', error);
      throw error;
    }
  }
};