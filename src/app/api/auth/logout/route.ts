import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const client = getSupabaseServerClient();
  if (!client) {
    return NextResponse.json({ error: "Auth not configured." }, { status: 503 });
  }
  await client.auth.signOut();
  return NextResponse.json({ ok: true });
}