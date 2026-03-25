import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { D1Adapter } from "@auth/d1-adapter";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
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

// Get DB from globalThis (Cloudflare Pages binding)
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
  throw new Error("Cannot find DB binding on globalThis. Check your Cloudflare Pages binding configuration.");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: D1Adapter(getDB()),
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
