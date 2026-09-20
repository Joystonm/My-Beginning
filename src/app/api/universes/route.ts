import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  createUniverseForUser,
  listUniversesForUser,
} from "@/lib/universes/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const universes = await listUniversesForUser(user.id);
  return NextResponse.json({ universes });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { name?: string; description?: string; color?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const created = await createUniverseForUser(user.id, {
    name,
    description: body.description,
    color: body.color as never,
  });
  if (!created) {
    return NextResponse.json(
      { error: "Could not create universe." },
      { status: 500 },
    );
  }
  return NextResponse.json({ universe: created });
}
