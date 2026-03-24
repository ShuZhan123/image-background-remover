import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { D1Adapter } from "@auth/d1-adapter";
import type { NextRequest } from "next/server";

declare global {
  type D1Database = {
    prepare: (query: string) => any;
    exec: (query: string) => any;
  };
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
  }
}

// In Cloudflare Pages with Next.js Edge Runtime, D1 bindings are available via:
// 1. request.context.env - for Cloudflare Pages Functions / middleware
// 2. globalThis - when configured via Pages deployment with wrangler
// 3. (request as any).cf.env - some configurations expose it here
function getDBFromRequest(request: NextRequest): D1Database {
  // @ts-ignore
  if (request.context && request.context.env && request.context.env.DB) {
    // @ts-ignore
    return request.context.env.DB as D1Database;
  }
  // @ts-ignore
  if ((request as any).cf && (request as any).cf.env && (request as any).cf.env.DB) {
    // @ts-ignore
    return (request as any).cf.env.DB as D1Database;
  }
  // @ts-ignore
  if (typeof globalThis !== 'undefined' && globalThis.DB) {
    // @ts-ignore
    return globalThis.DB as D1Database;
  }
  // @ts-ignore
  if (typeof self !== 'undefined' && self.DB) {
    // @ts-ignore
    return self.DB as D1Database;
  }
  throw new Error("Cannot find D1 binding 'DB' on the request object or globalThis. Please check your Cloudflare Pages binding configuration.");
}

export async function GET(request: NextRequest) {
  const db = getDBFromRequest(request);
  const { handlers } = NextAuth({
    providers: [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ],
    adapter: D1Adapter(db),
    session: {
      strategy: "jwt",
    },
    pages: {
      signIn: "/auth/signin",
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id as string;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id;
        }
        return session;
      },
    },
  });
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const db = getDBFromRequest(request);
  const { handlers } = NextAuth({
    providers: [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ],
    adapter: D1Adapter(db),
    session: {
      strategy: "jwt",
    },
    pages: {
      signIn: "/auth/signin",
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id as string;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id;
        }
        return session;
      },
    },
  });
  return handlers.POST(request);
}

export const runtime = "edge";
