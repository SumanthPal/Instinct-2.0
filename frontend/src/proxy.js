// Next.js 16 "proxy" (formerly middleware). Refreshes the Supabase session and
// gates only routes that actually require a signed-in user.
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

function needsAuth(pathname) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname === '/club/add' ||
    pathname.startsWith('/club/add/')
  )
}

export async function proxy(req) {
  try {
    let res = NextResponse.next({ request: req })
    // Proof for local VE that the proxy ran on this request.
    res.headers.set('x-instinct-proxy', '1')

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
            res = NextResponse.next({ request: req })
            res.headers.set('x-instinct-proxy', '1')
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    // getUser() revalidates the token with Supabase; getSession() does not.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (needsAuth(req.nextUrl.pathname) && !user) {
      const redirect = NextResponse.redirect(new URL('/', req.url))
      redirect.headers.set('x-instinct-proxy', '1')
      return redirect
    }

    return res
  } catch (e) {
    console.error('Proxy error:', e)
    const res = NextResponse.next()
    res.headers.set('x-instinct-proxy', 'error')
    return res
  }
}

export const config = {
  matcher: [
    /*
     * Run on app routes so the session can refresh. Skip Next internals and
     * static assets. /clubs and /club/[username] stay public.
     */
    '/((?!_next/static|_next/image|favicon.ico|logo\\.svg|logo\\.png|.*\\.(?:jpg|jpeg|gif|webp|svg|png|ico)$).*)',
  ],
}
