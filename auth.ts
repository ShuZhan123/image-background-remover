import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { D1Adapter } from "@auth/d1-adapter";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";

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

// In Cloudflare Pages, D1 bindings are NOT available on process.env at build time
// They are only available at runtime on the request object
// So we need to use getter to get it lazily
const config = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account consent",
          access_type: "online",
          response_type: "code",
          scope: "openid email profile",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  trustHost: true,
  useSecureCookies: true,
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        // @ts-ignore
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  debug: true,
};

// Lazy get adapter because DB is only available at runtime on Cloudflare Pages
// @ts-ignore - DB binding is injected by Cloudflare Pages at runtime
const getAdapter = () => {
  const db = (typeof process !== "undefined" && (process.env as any).DB) as D1Database;
  if (!db) {
    console.error("⚠️  DB binding not found on process.env");
    console.error("   Check that binding name is exactly: DB (uppercase)");
    return undefined;
  }
  console.log("✓ D1 DB found, using D1Adapter");
  return D1Adapter(db);
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...config,
  get adapter() {
    return getAdapter();
  },
});
