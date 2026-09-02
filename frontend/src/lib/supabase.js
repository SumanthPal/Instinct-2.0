// src/lib/supabase.js
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cached client instance
let supabaseClient = null;

export const createClient = () => {
  // Return existing client if already created
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Publishable key (sb_publishable_…); replaces the legacy anon JWT key
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabasePublishableKey) missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    throw new Error(
      `Supabase is not configured: missing ${missing.join(' and ')} in environment.`
    );
  }

  // Create a new client on first use
  supabaseClient = createSupabaseClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return supabaseClient;
};

// Lazy proxy that defers client creation to first property access
export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = createClient();
    const val = client[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});
