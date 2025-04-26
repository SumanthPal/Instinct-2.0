// src/lib/supabase.js
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Ensure environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

// Create a singleton client to be reused throughout the app
let supabaseClient = null;

export const createClient = () => {
  // Return existing client if already created
  if (supabaseClient) {
    return supabaseClient;
  }
  
  // Create a new client if none exists yet
  supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    // Add additional options as needed
  });
  
  return supabaseClient;
};

// You can also export a direct instance if you prefer
export const supabase = createClient();
