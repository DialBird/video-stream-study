import { COOKIE_NAME, ONE_YEAR_MS } from "@/shared/const";
import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { getSessionCookieOptions } from "@/lib/_core/cookies-next";
import { sdk } from "@/lib/_core/sdk";

function getQueryParam(req: NextRequest, key: string): string | null {
  const url = new URL(req.url);
  return url.searchParams.get(key);
}

export async function GET(req: NextRequest) {
  const code = getQueryParam(req, "code");
  const state = getQueryParam(req, "state");

  if (!code || !state) {
    return NextResponse.json({ error: "code and state are required" }, { status: 400 });
  }

  try {
    const tokenResponse = await sdk.exchangeCodeForToken(code, state);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

    if (!userInfo.openId) {
      return NextResponse.json({ error: "openId missing from user info" }, { status: 400 });
    }

    await db.upsertUser({
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS / 1000 });

    return response;
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    return NextResponse.json({ error: "OAuth callback failed" }, { status: 500 });
  }
}

