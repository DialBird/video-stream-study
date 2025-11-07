import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: NextRequest) {
  const url = new URL(req.url);
  if (url.protocol === "https:") return true;

  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (!forwardedProto) return false;

  const protoList = forwardedProto.split(",");
  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: NextRequest
): { httpOnly: boolean; path: string; sameSite: "none" | "lax" | "strict"; secure: boolean } {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}

