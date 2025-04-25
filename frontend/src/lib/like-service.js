// src/lib/like-service.js (note the singular name to match your import)
'use client'

import { createClient } from '@/lib/supabase';

export const likesService = {
  /**
   * Get all clubs liked by the current user
   */
  async getLikedClubs() {
    const supabase = createClient();
    
    try {
      // Check for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to view liked clubs');
      }
      
      // First, fetch all columns from clubs table to inspect the schema
      const { data: sampleClub, error: sampleError } = await supabase
        .from('clubs')
        .select('*')
        .limit(1);
      
      console.log('Club schema sample:', sampleClub);
      
      // Get user's liked clubs
      const { data, error } = await supabase
        .from('user_liked_clubs')
        .select(`
          instagram_handle,
          created_at
        `)
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      
      if (!data || data.length === 0) return [];
      
      // Get the full club details for each liked club using instagram handles
      const instagramHandles = data.map(item => item.instagram_handle);
      
      const { data: clubsData, error: clubsError } = await supabase
        .from('clubs')
        .select('*')
        .in('instagram_handle', instagramHandles);
      
      if (clubsError) throw clubsError;
      
      console.log('Raw club data:', clubsData);
      
      // Combine the data with flexible property access
      return clubsData.map(club => {
        const likeInfo = data.find(item => item.instagram_handle === club.instagram_handle);
        
        // Try to determine the instagram handle field name
        const instagramField = 
          club.instagram_handle !== undefined ? 'instagram_handle' : 
          club.instagram !== undefined ? 'instagram' : 
          club.handle !== undefined ? 'handle' : null;
        
        return {
          ...club,
          // Add standard properties that ClubCard expects
          instagram: club[instagramField] || '',  
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