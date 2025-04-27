import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Make this route dynamic to ensure it's not statically optimized
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const error = requestUrl.searchParams.get('error')
    const errorDescription = requestUrl.searchParams.get('error_description')

    // Handle error cases
    if (error) {
      console.error('Auth error:', error, errorDescription)
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(errorDescription || error)}`, requestUrl)
      )
    }

    // If we have a code, exchange it for a session
    if (code) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        console.error('Exchange error:', exchangeError.message)
        return NextResponse.redirect(
          new URL(`/?error=${encodeURIComponent(exchangeError.message)}`, requestUrl)
        )
      }

      // ✅ Now check the email
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Get user error:', userError.message);
        return NextResponse.redirect(
          new URL(`/?error=${encodeURIComponent('Failed to get user')}`, requestUrl)
        );
      }

      if (user && user.email && !user.email.endsWith('@uci.edu')) {
        console.log('Deleting non-UCI user:', user.email);

        // ❗ You CANNOT delete a user from a normal client session
        // You need to call the Admin API from the server (if you want full delete)
        // For now, easiest hack = sign them out immediately and redirect with error

        await supabase.auth.signOut();

        return NextResponse.redirect(
          new URL(`/?error=${encodeURIComponent('invalid-email')}`, requestUrl)
        );
      }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent('An unexpected error occurred')}`, request.url)
    )
  }
}
