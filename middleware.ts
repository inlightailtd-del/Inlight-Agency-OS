import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, parseCookieHeader } from '@supabase/ssr'

const publicRoutes = ['/login', '/signup', '/']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('cookie') ?? '')
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, any> }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // If user is authenticated
  if (user) {
    // Redirect from auth pages to dashboard
    if (path === '/login' || path === '/signup' || path === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  } else {
    // If user is not authenticated, protect all /dashboard/* routes
    if (path.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
