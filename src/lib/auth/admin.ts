import { createHmac, timingSafeEqual } from "node:crypto";
import { parse as parseCookie, serialize } from "cookie";
import type { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";

const COOKIE_NAME = "room-admin-session";

function createSignature(value: string) {
  return createHmac("sha256", getConfig().sessionSecret).update(value).digest("hex");
}

function getExpectedValue() {
  const payload = "admin";
  return `${payload}.${createSignature(payload)}`;
}

export function verifyAdminPassword(password: string) {
  const provided = createSignature(`password:${password}`);
  const expected = createSignature(`password:${getConfig().adminPassword}`);
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function createAdminSessionCookie() {
  return serialize(COOKIE_NAME, getExpectedValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: getConfig().nodeEnv === "production",
    maxAge: 60 * 60 * 8
  });
}

export function clearAdminSessionCookie() {
  return serialize(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: getConfig().nodeEnv === "production",
    maxAge: 0
  });
}

export function isAdminRequest(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return hasValidAdminCookie(cookieHeader);
}

export function hasValidAdminCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return false;
  }

  const cookies = parseCookie(cookieHeader);
  return cookies[COOKIE_NAME] === getExpectedValue();
}
