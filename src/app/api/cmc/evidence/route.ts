import { NextResponse } from "next/server";
import {
  getCmcEvidence,
  getCurrentDataSource,
  getSeedInfo,
} from "@/lib/cmc/client";

export const dynamic = "force-dynamic";

/**
 * Returns sanitized API call records for the API Evidence UI.
 * No API key, no full responses — just endpoints, parameters,
 * timings, credit counts, and tier-safe samples.
 *
 * Also returns the current data source so the UI can clearly
 * distinguish "live CMC" from "synthetic development seed".
 */
export async function GET() {
  return NextResponse.json({
    data: getCmcEvidence(),
    source: getCurrentDataSource(),
    apiKeyConfigured: Boolean(process.env.CMC_API_KEY),
    seed: getSeedInfo(),
  });
}
