import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

const publicRoutes = ['/login', '/signup', '/']
const dashboardRoutes = [
  '/dashboard',
  '/dashboard/clients',
  '/dashboard/projects',
  '/dashboard/tasks',
  '/dashboard/finance',
  '/dashboard/brain',
  '/dashboard/agents',
]

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
    // If user is not authenticated
    // Allow public routes
    if (publicRoutes.includes(path) || !path.startsWith('/')) {
      return response
    }

    // Check if accessing dashboard routes without authentication
    const isDashboardRoute = dashboardRoutes.some(route => path.startsWith(route))
    
    if (isDashboardRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
