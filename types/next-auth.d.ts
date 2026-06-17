import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: string;
      barberia_id: string;
    } & DefaultSession["user"];
  }

  interface User {
    rol?: string;
    barberia_id?: string;
  }
}
