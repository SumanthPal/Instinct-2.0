'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast';

const AuthContext = createContext()
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function AuthProvider({ children }) {
  const searchParams = useSearchParams();

  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast();

  const [toastShown, setToastShown] = useState(false); // 🔥 NEW GUARD


  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      await handleSession(session)
    }
    
    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])
  useEffect(() => {
    const error = searchParams.get('error');

    if (error === 'invalid-email' && !toastShown) {
      
      setTimeout(() => {
        toast({
          title: 'Invalid Email',
          description: 'Please sign in with your UCI email address.',
          status: 'error', // Make sure your toast component supports 'status'
          duration: 4000,
          isClosable: true,
        });
      }, 100);

      setToastShown(true); // ✅ Mark as shown
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url);
    }
  }, [searchParams, router, toast, toastShown]); // watch toastShown too!


  const handleSession = async (session) => {
    if (session?.user) {
      const email = session.user.email

      if (email && !email.endsWith('@uci.edu')) {
        console.warn('Non-UCI email detected. Signing out user:', email)
        
        // Immediately sign them out
        await supabase.auth.signOut()

        // Optionally redirect to home or error page
        router.push('/?error=invalid-email')
        
        setUser(null)
        setSession(null)
        setLoading(false)
        return
      }

      setSession(session)
      setUser(session.user)
    } else {
      setSession(null)
      setUser(null)
    }

    setLoading(false)
  }

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
            redirectTo: `${siteUrl}/auth/callback`,  // ✅ cleaner and correct
          },
        });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      // Push error to homepage
      router.push('/?error=invalid-login');
    }
  };
  

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  const value = {
    user,
    session,
    signInWithGoogle,
    signOut,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
