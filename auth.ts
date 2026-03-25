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

// In Cloudflare Pages/Edge Functions:
// - DB binding is on request.env.DB
// - All environment variables are also on request.env
// process.env doesn't work in edge runtime!
function authWithRequest(request: NextRequest) {
  // @ts-ignore - everything is on request.env in Cloudflare Pages
  const env = request.env as {
    DB: D1Database;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    NEXTAUTH_URL: string;
    NEXTAUTH_SECRET: string;
  };

  const db = env.DB;
  if (!db) {
    throw new Error("Cannot find DB binding on request.env. Check your Cloudflare Pages binding configuration.");
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found in request.env. Check your environment variables in Cloudflare Pages.");
  }

  return NextAuth({
    adapter: D1Adapter(db),
    providers: [
      Google({
        clientId,
        clientSecret,
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
    cookies: {
      csrfToken: {
        name: "next-auth.csrf-token",
        secure: true,
      },
      callbackUrl: {
        name: "next-auth.callback-url",
        secure: true,
      },
    },
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
  try {
    const { handlers } = authWithRequest(request);
    return await handlers.GET(request);
  } catch (error) {
    console.error("Auth GET error:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { handlers } = authWithRequest(request);
    return await handlers.POST(request);
  } catch (error) {
    console.error("Auth POST error:", error);
    throw error;
  }
}

// For client-side signIn/signOut - client doesn't have request.env
// Use process.env as fallback, which works for build/client
export const { auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
})
