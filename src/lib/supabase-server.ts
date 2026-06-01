import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server-side Supabase client with cookie-based auth (for Server Components & Route Handlers) */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const isDev = process.env.NODE_ENV === "development";
            cookiesToSet.forEach(({ name, value, options }) => {
              const cookieOptions = { ...options };
              if (isDev) {
                cookieOptions.secure = false;
              }
              cookieStore.set(name, value, cookieOptions);
            });
          } catch {
            // setAll can throw in Server Components (read-only).
            // This is fine — the middleware handles cookie refresh.
          }
        },
      },
    }
  );
}
