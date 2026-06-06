import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

// Build-safe Supabase client initialization
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createBrowserSupabase() {
  if (browserClient) return browserClient;

  // PKCE flow requires window.crypto.subtle. On non-secure local IP addresses,
  // crypto.subtle is undefined, so we fall back to implicit flow.
  const isBrowser = typeof window !== "undefined";
  const hasCrypto = isBrowser && !!(window.crypto && window.crypto.subtle);

  const isDev = process.env.NODE_ENV === "development";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";

  browserClient = createBrowserClient(
    url,
    anonKey,
    {
      auth: {
        flowType: !isBrowser || hasCrypto ? "pkce" : "implicit",
      },
      cookieOptions: {
        secure: !isDev,
      },
    }
  );
  return browserClient;
}

/** Server-side Supabase client (service role, bypasses RLS) — singleton */
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-service-key";

  adminClient = createClient(
    url,
    serviceKey,
    { auth: { persistSession: false } }
  );
  return adminClient;
}

/**
 * Broadcast a message to all Supabase Realtime subscribers on a channel.
 * Uses the HTTP REST endpoint (no WebSocket needed, works in serverless).
 *
 * The supabase-js client prepends "realtime:" to channel names internally,
 * so we must match that prefix here for the message to reach browser clients.
 */
export async function broadcastToChannel(
  topic: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ topic, event, payload }],
      }),
    });
  } catch {
    // Fire and forget — broadcast failure should never block the API response
  }
}

/**
 * Universal GitHub OAuth Sign-In handler.
 * Dynamically detects Capacitor native platform and uses Chrome Custom Tabs (@capacitor/browser).
 * Otherwise falls back to browser redirect flow.
 */
export async function triggerGitHubLogin(supabase: ReturnType<typeof createBrowserSupabase>, path = "/") {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const isNative = Capacitor.isNativePlatform();
    const origin = typeof window !== "undefined" ? window.location.origin : "https://cluster-git.883742.xyz";
    const redirectUrl = isNative
      ? "gitsocial://auth/callback"
      : `${origin}/auth/callback?next=${encodeURIComponent(path)}`;

    if (isNative) {
      const { Browser } = await import("@capacitor/browser");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: redirectUrl,
          scopes: "repo user:follow",
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        alert("Sign in failed: " + error.message);
        return;
      }
      if (data?.url) {
        await Browser.open({ url: data.url });
      }
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: redirectUrl,
          scopes: "repo user:follow",
        },
      });
      if (error) {
        alert("Sign in failed: " + error.message);
      }
    }
  } catch (err: any) {
    alert("Sign in error: " + (err?.message || err));
  }
}
