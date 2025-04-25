// middleware.js (should be at the root of your project)

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  try {
    const res = NextResponse.next()
    
    // Create a Supabase client configured to use cookies
    const supabase = createMiddlewareClient({ req, res })
    
    // Refresh session if expired & still valid
    await supabase.auth.getSession()
    
    // Check if we have a session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Check if the user is trying to access a protected route
    if ((req.nextUrl.pathname.startsWith('/dashboard') || 
         req.nextUrl.pathname.startsWith('/club') ||
         req.nextUrl.pathname.startsWith('/clubs')) && 
        !session) {
      // Redirect unauthenticated users to home page
      return NextResponse.redirect(new URL('/', req.url))
    }

    return res
  } catch (e) {
    // If there's an error, skip the middleware and let the request through
    console.error('Middleware error:', e)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * But DO match:
     * - /dashboard routes
     * - /club routes 
     * - /clubs routes
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|public/).*)',
    '/dashboard/:path*',
    '/club/:path*',
    '/clubs/:path*',
  ],
}