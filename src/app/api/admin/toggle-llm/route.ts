import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/auth/admin";
import { logAdminAction, setLlmEnabled } from "@/lib/domain/system";
import { emitLlmState } from "@/lib/socket/server";

const bodySchema = z.object({
  enabled: z.boolean()
});

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    setLlmEnabled(body.enabled);
    logAdminAction("toggle-llm", { enabled: body.enabled });
    emitLlmState(body.enabled);

    return NextResponse.json({ llmEnabled: body.enabled });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update state." },
      { status: 400 }
    );
  }
}
