import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/lib/routers";

export const trpc = createTRPCReact<AppRouter>();

