import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { D1Adapter } from "@auth/d1-adapter";
import type { NextRequest } from "next/server";

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

// In Cloudflare Pages with Next.js, all bindings are on globalThis
// Let's just get it directly from globalThis when handling the request
function getDB(): D1Database {
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
  throw new Error("Cannot find DB binding on globalThis. Please check that you have correctly bound the D1 database in Cloudflare Pages settings.");
}

let cachedAuth: ReturnType<typeof NextAuth> | undefined;

function getAuth() {
  if (!cachedAuth) {
    const db = getDB();
    cachedAuth = NextAuth({
      adapter: D1Adapter(db),
      providers: [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ],
      session: {
        strategy: "jwt",
      },
      pages: {
        signIn: "/auth/signin",
      },
      callbacks: {
        async jwt({ token, user }) {
          if (user?.id) {
            // @ts-ignore
            token.id = user.id;
          }
          return token;
        },
        async session({ session, token }) {
          if (session.user) {
            // @ts-ignore
            session.user.id = token.id;
          }
          return session;
        },
      },
      debug: true,
    });
  }
  return cachedAuth;
}

export async function GET(request: NextRequest) {
  const { handlers } = getAuth();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const { handlers } = getAuth();
  return handlers.POST(request);
}

export const runtime = "edge";
