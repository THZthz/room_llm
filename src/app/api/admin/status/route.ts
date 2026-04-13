import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth/admin";
import { getLiveState } from "@/lib/state/live";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    authenticated: isAdminRequest(request),
    llmEnabled: getLiveState().isLlmEnabled()
  });
}
