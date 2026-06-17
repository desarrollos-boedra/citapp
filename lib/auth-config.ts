import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        barberia_id: {},
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const barberiaId = credentials?.barberia_id as string | undefined;

        if (!email || !password || !barberiaId) return null;

        const supabase = supabaseAdmin();
        const { data: usuario } = await supabase
          .from("usuarios")
          .select("id, nombre, email, password, rol, barberia_id")
          .eq("email", email)
          .eq("barberia_id", barberiaId)
          .single();

        if (!usuario) return null;

        const passwordOk = await bcrypt.compare(password, usuario.password);
        if (!passwordOk) return null;

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          barberia_id: usuario.barberia_id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = (user as { rol?: string }).rol;
        token.barberia_id = (user as { barberia_id?: string }).barberia_id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as string;
        session.user.barberia_id = token.barberia_id as string;
      }
      return session;
    },
  },
});
