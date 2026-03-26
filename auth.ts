import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { D1Adapter } from "@auth/d1-adapter";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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

// Get DB from Cloudflare Context correctly
const getDB = () => {
  const ctx = getCloudflareContext();
  return (ctx.env as any).DB as D1Database;
};

// Get env variables
const getEnv = () => {
  const ctx = getCloudflareContext();
  return {
    DB: getDB(),
    GOOGLE_CLIENT_ID: (ctx.env as any).GOOGLE_CLIENT_ID as string,
    GOOGLE_CLIENT_SECRET: (ctx.env as any).GOOGLE_CLIENT_SECRET as string,
    NEXTAUTH_SECRET: (ctx.env as any).NEXTAUTH_SECRET as string,
    NEXTAUTH_URL: (ctx.env as any).NEXTAUTH_URL as string,
  };
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  get adapter() {
    return D1Adapter(getDB());
  },
  secret: process.env.NEXTAUTH_SECRET || getEnv().NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || getEnv().GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || getEnv().GOOGLE_CLIENT_SECRET,
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
  },
  trustHost: true,
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
