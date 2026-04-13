import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth/admin";
import { listClientsWithPresence } from "@/lib/domain/clients";
import { getLiveState } from "@/lib/state/live";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    clients: listClientsWithPresence(),
    llmEnabled: getLiveState().isLlmEnabled()
  });
}
