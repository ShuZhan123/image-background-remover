import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { D1Adapter } from "@auth/d1-adapter";

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

// In Cloudflare Pages with Next.js, the environment bindings are available via process.env
// But D1 bindings are actually exposed as global objects in the Edge runtime
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
  if (typeof process !== 'undefined' && process.env) {
    // @ts-ignore
    if (process.env.DB) {
      // @ts-ignore
      return process.env.DB as D1Database;
    }
  }
  throw new Error("Cannot find D1 binding 'DB' in the current environment. Please check your Cloudflare Pages binding configuration.");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  adapter: D1Adapter(getDB()),
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
  debug: process.env.NODE_ENV === "development",
});
