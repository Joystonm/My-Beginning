import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { reorderAssetsForUser } from "@/lib/universes/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { order?: number[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!Array.isArray(body.order) || body.order.some((n) => typeof n !== "number")) {
    return NextResponse.json(
      { error: "order must be an array of cmc_id numbers." },
      { status: 400 },
    );
  }
  const updated = await reorderAssetsForUser(user.id, params.id, body.order);
  if (!updated) {
    return NextResponse.json({ error: "Could not reorder assets." }, { status: 404 });
  }
  return NextResponse.json({ universe: updated });
}
