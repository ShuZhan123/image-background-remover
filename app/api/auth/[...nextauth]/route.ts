import type { NextRequest } from "next/server";
import { getHandlers } from "../../../../auth";

// In Cloudflare Pages with Next.js Edge Runtime, D1 bindings are available via:
// https://developers.cloudflare.com/pages/functions/bindings/#how-bindings-are-exposed
function getDBFromRequest(request: NextRequest): D1Database {
  // Cloudflare Pages Functions for Next.js exposes env via request.context.env
  // @ts-ignore
  if (request.context?.env?.DB !== undefined) {
    // @ts-ignore
    return request.context.env.DB as D1Database;
  }
  // Fallback to cf.env
  // @ts-ignore
  if (request.cf?.env?.DB !== undefined) {
    // @ts-ignore
    return request.cf.env.DB as D1Database;
  }
  // Fallback to global
  // @ts-ignore
  if (typeof globalThis !== 'undefined' && globalThis.DB !== undefined) {
    // @ts-ignore
    return globalThis.DB as D1Database;
  }
  // Fallback to self
  // @ts-ignore
  if (typeof self !== 'undefined' && self.DB !== undefined) {
    // @ts-ignore
    return self.DB as D1Database;
  }
  throw new Error("Cannot find D1 binding 'DB'. Please check:\n1. Did you create the D1 database?\n2. Did you bind it to your Cloudflare Pages project with name 'DB'?\n3. Is the binding correctly configured in your Cloudflare dashboard?");
}

export async function GET(request: NextRequest) {
  const db = getDBFromRequest(request);
  const handlers = getHandlers(db);
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const db = getDBFromRequest(request);
  const handlers = getHandlers(db);
  return handlers.POST(request);
}

export const runtime = "edge";
