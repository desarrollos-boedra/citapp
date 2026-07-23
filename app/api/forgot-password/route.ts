import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email, slug } = await req.json();
  if (!email || !slug) return NextResponse.json({ ok: true }); // siempre ok para no revelar si existe

  const supabase = supabaseAdmin();

  // Buscar barbería por slug
  const { data: barberia } = await supabase
    .from("barberias")
    .select("id, nombre")
    .eq("slug", slug)
    .single();

  if (!barberia) return NextResponse.json({ ok: true });

  // Buscar usuario
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nombre")
    .eq("email", email)
    .eq("barberia_id", barberia.id)
    .single();

  if (!usuario) return NextResponse.json({ ok: true });

  // Generar token
  const token = crypto.randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

  await supabase.from("password_reset_tokens").insert({
    usuario_id: usuario.id,
    token,
    expires_at,
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/${slug}/reset-password?token=${token}`;

  await resend.emails.send({
    from: "noreply@boedra.com",
    to: email,
    subject: `Recupera tu contraseña — ${barberia.nombre}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Recupera tu contraseña</h2>
        <p style="color: #666; margin-bottom: 24px;">Hola ${usuario.nombre}, haz click en el botón para crear una nueva contraseña. El enlace expira en 1 hora.</p>
        <a href="${link}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Cambiar contraseña
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Si no solicitaste esto, ignora este email.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}