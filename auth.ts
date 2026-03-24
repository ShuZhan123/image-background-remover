import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

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

// Shared config for use in other parts of the app (like app/page.tsx)
export function createAuthConfig(db: D1Database) {
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
}

// For pages that use auth(), we need to have a default export
// In Next.js Pages Router, this would be different, but in App Router
// we only need this for server components calling auth()
let authInstance: ReturnType<typeof NextAuth> | undefined;

export function getAuth(db: D1Database) {
  if (!authInstance) {
    authInstance = createAuthConfig(db);
  }
  return authInstance;
}

export const auth = () => {
  // In server components, try to get DB from global
  let db: D1Database;
  // @ts-ignore
  if (typeof globalThis !== 'undefined' && globalThis.DB) {
    // @ts-ignore
    db = globalThis.DB as D1Database;
  } else {
    // @ts-ignore
    if (typeof self !== 'undefined' && self.DB) {
      // @ts-ignore
      db = self.DB as D1Database;
    } else {
      throw new Error("Cannot find D1 binding 'DB' for auth() call");
    }
  }
  return getAuth(db).auth();
};

export const signIn = () => {
  let db: D1Database;
  // @ts-ignore
  if (typeof globalThis !== 'undefined' && globalThis.DB) {
    // @ts-ignore
    db = globalThis.DB as D1Database;
  } else {
    // @ts-ignore
    if (typeof self !== 'undefined' && self.DB) {
      // @ts-ignore
      db = self.DB as D1Database;
    } else {
      throw new Error("Cannot find D1 binding 'DB' for signIn() call");
    }
  }
  return getAuth(db).signIn();
};

export const signOut = () => {
  let db: D1Database;
  // @ts-ignore
  if (typeof globalThis !== 'undefined' && globalThis.DB) {
    // @ts-ignore
    db = globalThis.DB as D1Database;
  } else {
    // @ts-ignore
    if (typeof self !== 'undefined' && self.DB) {
      // @ts-ignore
      db = self.DB as D1Database;
    } else {
      throw new Error("Cannot find D1 binding 'DB' for signOut() call");
    }
  }
  return getAuth(db).signOut();
};
