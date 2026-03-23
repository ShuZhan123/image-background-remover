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

export function createAuth(db: D1Database) {
  return NextAuth({
    providers: [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ],
    adapter: D1Adapter(db),
    session: {
      strategy: "database",
    },
    pages: {
      signIn: "/auth/signin",
    },
    callbacks: {
      session({ session, user }) {
        if (session.user) {
          session.user.id = user.id as string;
        }
        return session;
      },
    },
  });
}

// For local development fallback
export const { handlers, auth, signIn, signOut } = createAuth(
  (process.env.DB as unknown as D1Database)
);
