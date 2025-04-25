// src/lib/supabase-server.js
// This file runs only on the server

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Server-side environment variables (no NEXT_PUBLIC_ prefix required)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // More powerful than the anon key

export const createClient = () => {
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};