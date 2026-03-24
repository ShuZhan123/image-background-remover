import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
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

// Find or create user in D1 database when signing in
async function findOrCreateUser(profile: {
  email?: string | null;
  name?: string | null;
  image?: string | null;
}) {
  const db = getDB();
  const email = profile.email || "";

  // Try to find existing user by email
  const result = await db.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first();

  if (result) {
    // User exists, return it
    return { id: String(result.id), ...result };
  }

  // User doesn't exist, create new
  const { success } = await db.prepare(`
    INSERT INTO users (name, email, email_verified, image)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
  `).bind(profile.name || null, email, profile.image || null).run();

  if (!success) {
    throw new Error("Failed to create user in D1 database");
  }

  // Get the newly created user
  const newUser = await db.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first();
  return { id: String(newUser.id), ...newUser };
}

export function getAuth() {
  return NextAuth({
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
    trustHost: true,
    useSecureCookies: true,
    callbacks: {
      async signIn({ user, profile }) {
        const userProfile = profile || user;
        if (!userProfile || !userProfile.email) return true;
        // Store user in D1
        await findOrCreateUser(userProfile);
        return true;
      },
      async jwt({ token, user, profile }) {
        const userProfile = profile || user;
        if (userProfile && userProfile.email) {
          // Find user and add id to token
          const dbUser = await findOrCreateUser(userProfile);
          token.id = dbUser.id;
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
    debug: process.env.NODE_ENV === "development",
  });
}

export async function GET(request: NextRequest) {
  const { handlers } = getAuth();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const { handlers } = getAuth();
  return handlers.POST(request);
}

export const auth = () => getAuth().auth();
export const signIn = () => getAuth().signIn();
export const signOut = () => getAuth().signOut();
