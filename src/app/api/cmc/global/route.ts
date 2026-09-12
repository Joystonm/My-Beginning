import { NextResponse } from "next/server";
import {
  getCurrentDataSource,
  getGlobalMetrics,
  getSeedInfo,
} from "@/lib/cmc/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getGlobalMetrics();
    return NextResponse.json({
      data,
      source: getCurrentDataSource(),
      seed: getSeedInfo(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "CMC request failed." },
      { status: 502 },
    );
  }
}
