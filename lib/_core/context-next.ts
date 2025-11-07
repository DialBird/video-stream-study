import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getBypassAuth } from "../db";

export type TrpcContext = {
  req: Request;
  user: User | null;
};

export async function createContext(opts: FetchCreateContextFnOptions): Promise<TrpcContext> {
  let user: User | null = null;

  // Development mode: bypass authentication (check DB first, then env var for backward compatibility)
  const bypassAuth = await getBypassAuth();
  if (bypassAuth) {
    user = {
      id: 1,
      openId: "dev-user",
      name: "Development User",
      email: "dev@example.com",
      loginMethod: "bypass",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  } else {
    try {
      // Convert Request to Express-like request for SDK compatibility
      const expressReq = {
        headers: {
          cookie: opts.req.headers.get("cookie") || "",
        },
      } as any;
      user = await sdk.authenticateRequest(expressReq);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    user,
  };
}

