import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = cookies()
  const headerStore = headers()

  // Support Authorization: Bearer header for API testing
  const authHeader = headerStore.get('authorization')
  let authHeaders: Record<string, string> = {}
  if (authHeader?.startsWith('Bearer ')) {
    authHeaders['Authorization'] = authHeader
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, any> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      global: Object.keys(authHeaders).length > 0 ? { headers: authHeaders } : undefined,
    }
  )
}
