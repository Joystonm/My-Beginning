import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import {
  addAssetForUser,
  removeAssetForUser,
} from "@/lib/universes/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { cmcId?: number; symbol?: string; name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.cmcId !== "number" || !body.symbol || !body.name) {
    return NextResponse.json(
      { error: "cmcId, symbol and name are required." },
      { status: 400 },
    );
  }
  const updated = await addAssetForUser(user.id, params.id, {
    cmcId: body.cmcId,
    symbol: body.symbol,
    name: body.name,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Could not add asset to universe." },
      { status: 404 },
    );
  }
  return NextResponse.json({ universe: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const cmcIdParam = url.searchParams.get("cmcId");
  const cmcId = cmcIdParam ? Number(cmcIdParam) : NaN;
  if (!Number.isFinite(cmcId)) {
    return NextResponse.json({ error: "cmcId is required." }, { status: 400 });
  }
  const updated = await removeAssetForUser(user.id, params.id, cmcId);
  if (!updated) {
    return NextResponse.json(
      { error: "Could not remove asset from universe." },
      { status: 404 },
    );
  }
  return NextResponse.json({ universe: updated });
}
