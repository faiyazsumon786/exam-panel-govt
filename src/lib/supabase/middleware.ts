import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/types/database.types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (user) {
    // Check user profile from database
    const { data: profile } = await (supabase
      .from('users') as any)
      .select('role, status')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'student'
    const status = profile?.status || 'pending'

    // If logged in, login/register redirects to portal
    if (path === '/login' || path === '/register') {
      const url = request.nextUrl.clone()
      url.pathname = `/${role}`
      return NextResponse.redirect(url)
    }

    // Redirect to profile complete page or pending if pending
    if (status === 'pending' && path !== '/pending') {
      const url = request.nextUrl.clone()
      url.pathname = '/pending'
      return NextResponse.redirect(url)
    }

    if (status === 'approved' && path === '/pending') {
      const url = request.nextUrl.clone()
      url.pathname = `/${role}`
      return NextResponse.redirect(url)
    }

    if (status === 'rejected' && path !== '/unauthorized') {
      // Treat as unauthorized
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    // Protect portals
    if (path.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    if (path.startsWith('/mentor') && role !== 'mentor') {
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    if (path.startsWith('/student') && role !== 'student') {
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }
  } else {
    // If not logged in and trying to access protected paths
    const isProtected = ['/admin', '/mentor', '/student', '/profile', '/pending'].some(
      (prefix) => path.startsWith(prefix)
    )

    if (isProtected) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
