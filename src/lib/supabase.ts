import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { getSecret } from "astro:env/server";

function getSupabaseConfig() {
  const url = getSecret("SUPABASE_URL");
  const key = getSecret("SUPABASE_KEY");

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return parseCookieHeader(requestHeaders.get("Cookie") ?? "").map(({ name, value }) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
