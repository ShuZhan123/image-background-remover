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

// In Cloudflare Pages/Edge Functions, DB is on request.env, not global
// We need to create a new D1Adapter that gets DB from request
function authWithDB(request: NextRequest) {
  // @ts-ignore - request.env is where Cloudflare binds DB
  const db = request.env.DB as D1Database;
  if (!db) {
    throw new Error("Cannot find DB binding on request.env. Check your Cloudflare Pages binding configuration.");
  }

  return NextAuth({
    adapter: D1Adapter(db),
    providers: [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            prompt: "select_account consent",
            access_type: "online",
            response_type: "code",
            scope: "openid email profile"
          }
        }
      }),
    ],
    session: {
      strategy: "jwt",
    },
    pages: {
      signIn: "/auth/signin",
    },
    trustHost: true,
    useSecureCookies: true,
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          // @ts-ignore
          session.user.id = token.id as string;
        }
        return session;
      },
    },
    debug: true,
  });
}

export async function GET(request: NextRequest) {
  const { handlers } = authWithDB(request);
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const { handlers } = authWithDB(request);
  return handlers.POST(request);
}

// For client-side signIn/signOut
export const { auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
})
