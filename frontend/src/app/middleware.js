// middleware.js (should be at the root of your project)

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  try {
    let res = NextResponse.next({ request: req })

    // Create a Supabase client configured to use cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
            res = NextResponse.next({ request: req })
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    // Refresh the session if it expired and read the authenticated user.
    // getUser() revalidates the token with Supabase; getSession() does not.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Check if the user is trying to access a protected route
    if ((req.nextUrl.pathname.startsWith('/dashboard') || 
         req.nextUrl.pathname.startsWith('/club') ||
         req.nextUrl.pathname.startsWith('/clubs')) && 
        !user) {
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
