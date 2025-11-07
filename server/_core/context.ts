import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getBypassAuth } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
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
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
