import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, parseCookieHeader } from '@supabase/ssr'

const publicRoutes = ['/login', '/signup', '/', '/api/test']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    const path = request.nextUrl.pathname
    if (path.startsWith('/dashboard') && !path.startsWith('/login')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
    })

    const { data: { user } } = await supabase.auth.getUser()
    const path = request.nextUrl.pathname

    if (user) {
      if (path === '/login' || path === '/signup' || path === '/') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } else {
      if (path.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }
  } catch {
    // If Supabase auth fails, allow public routes
    const path = request.nextUrl.pathname
    if (path.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
