import { NextResponse } from "next/server";
import { getAiRemaining, AI_DAILY_LIMIT } from "@/lib/aiUsage";

export async function GET() {
  const remaining = await getAiRemaining();
  return NextResponse.json({ remaining, limit: AI_DAILY_LIMIT });
}
