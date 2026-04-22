import type { DefaultSession } from "next-auth";
import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: DefaultSession["user"] & {
      /** Set from JWT `sub` in session callback (same as Nest JWT subject). */
      id?: string;
    };
  }
  interface User {
    id?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    name?: string;
    email?: string;
  }
}
