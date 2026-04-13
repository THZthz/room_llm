import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSessionCookie, verifyAdminPassword } from "@/lib/auth/admin";

const bodySchema = z.object({
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    if (!verifyAdminPassword(body.password)) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Set-Cookie": createAdminSessionCookie()
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to log in." },
      { status: 400 }
    );
  }
}
