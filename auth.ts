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

let authInstance: ReturnType<typeof NextAuth> | undefined;

function getAuth(db: D1Database) {
  if (!authInstance) {
    authInstance = NextAuth({
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
  return authInstance;
}

export function getHandlers(db: D1Database) {
  return getAuth(db).handlers;
}

export const auth = () => {
  throw new Error("auth() should not be used in App Router API route. DB is obtained from request.");
};

export {};
