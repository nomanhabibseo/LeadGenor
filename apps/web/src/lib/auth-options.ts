import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/** Server-side API base (must reach Nest from the Next.js server, not the browser). */
function apiBaseUrl() {
  const u =
    process.env.API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:4000";
  return u.replace(/\/$/, "");
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const base = apiBaseUrl();
        try {
          const res = await fetch(`${base}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
            cache: "no-store",
          });
          if (!res.ok) return null;
          const data = (await res.json()) as {
            accessToken: string;
            user: { id: string; email: string; name: string };
          };
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name ?? "",
            accessToken: data.accessToken,
          };
        } catch (e) {
          console.error("[next-auth] Login API unreachable at", base, e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && "accessToken" in user) {
        const u = user as { accessToken: string; name?: string; email?: string; id?: string };
        token.accessToken = u.accessToken;
        if (u.name !== undefined) token.name = u.name;
        if (u.email) token.email = u.email;
        if (u.id) token.sub = u.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as { accessToken?: string }).accessToken = token.accessToken as string;
        session.user.name = (token.name as string) ?? "";
        if (token.email) session.user.email = token.email as string;
        /** Stable id for React Query keys + server `sub` (same as Nest JWT subject). */
        if (token.sub) session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
