import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (!token || !password) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Buscar token válido
  const { data: resetToken } = await supabase
    .from("password_reset_tokens")
    .select("id, usuario_id, expires_at, used")
    .eq("token", token)
    .single();

  if (!resetToken) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }
  if (resetToken.used) {
    return NextResponse.json({ error: "Este enlace ya fue usado" }, { status: 400 });
  }
  if (new Date(resetToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "El enlace ha expirado" }, { status: 400 });
  }

  // Actualizar contraseña
  const hash = await bcrypt.hash(password, 10);
  await supabase
    .from("usuarios")
    .update({ password: hash })
    .eq("id", resetToken.usuario_id);

  // Marcar token como usado
  await supabase
    .from("password_reset_tokens")
    .update({ used: true })
    .eq("id", resetToken.id);

  return NextResponse.json({ ok: true });
}