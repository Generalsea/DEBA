import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase public environment variables.");
  return createBrowserClient<Database>(url, key);
}
