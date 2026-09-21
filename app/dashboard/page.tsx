import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main style={{ padding: "2rem" }}>
      <h1>DEBA Dashboard</h1>
      <p>{user ? `Signed in as ${user.email ?? "DEBA user"}` : "You are not signed in."}</p>
    </main>
  );
}
