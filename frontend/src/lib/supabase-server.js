// src/lib/supabase-server.js
// This file runs only on the server

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Server-side environment variables (no NEXT_PUBLIC_ prefix required)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Secret key (sb_secret_…); replaces the legacy service_role JWT key.
// More powerful than the publishable key — server-side only.
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

export const createClient = () => {
  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};