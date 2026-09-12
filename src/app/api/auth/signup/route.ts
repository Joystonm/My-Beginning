import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const client = getSupabaseServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Authentication is not configured on this server." },
      { status: 503 },
    );
  }
  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const displayName = body.displayName?.trim() ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: displayName ? { display_name: displayName } : undefined },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ user: data.user });
}