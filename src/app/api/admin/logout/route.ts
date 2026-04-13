import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/auth/admin";

export async function POST() {
  return NextResponse.json(
    { success: true },
    {
      headers: {
        "Set-Cookie": clearAdminSessionCookie()
      }
    }
  );
}
