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

// Debug: check what's available
console.log("=== Auth Debug ===");
console.log("process.env.DB exists:", !!((process.env as any).DB));
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "✓ exists" : "✗ missing");
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "✓ exists" : "✗ missing");
console.log("NEXTAUTH_SECRET:", process.env.NEXTAUTH_SECRET ? "✓ exists" : "✗ missing");
console.log("NEXTAUTH_URL:", process.env.NEXTAUTH_URL);

// Cloudflare Pages 会把所有环境变量（包括 D1 bindings）放到 process.env 中
// 参见 Cloudflare Pages 文档：https://developers.cloudflare.com/pages/platform/functions/bindings/
const db = (process.env as any).DB as D1Database;

if (!db) {
  console.error("ERROR: DB binding not found in process.env!");
  console.error("Please check Cloudflare Pages D1 binding name is exactly 'DB' (uppercase)");
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error("ERROR: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing from environment variables!");
}

if (!process.env.NEXTAUTH_SECRET) {
  console.error("ERROR: NEXTAUTH_SECRET missing from environment variables!");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: db ? D1Adapter(db) : undefined,
  secret: process.env.NEXTAUTH_SECRET,
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
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  trustHost: true,
  useSecureCookies: true,
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
});
