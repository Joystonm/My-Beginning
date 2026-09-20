import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  deleteUniverseForUser,
  renameUniverseForUser,
} from "@/lib/universes/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
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
  const updated = await renameUniverseForUser(user.id, params.id, {
    name: body.name,
    description: body.description,
    color: body.color as never,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Could not update universe." },
      { status: 404 },
    );
  }
  return NextResponse.json({ universe: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ok = await deleteUniverseForUser(user.id, params.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not delete universe." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
