import { createAuth } from "../../../../auth";
import type { NextRequest } from "next/server";

export const runtime = "edge";

// In Cloudflare Pages Next.js, D1 binding is available via request.cf.env
export async function GET(request: NextRequest) {
  const db = (request as any).cf.env.DB;
  const { handlers } = createAuth(db);
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const db = (request as any).cf.env.DB;
  const { handlers } = createAuth(db);
  return handlers.POST(request);
}
