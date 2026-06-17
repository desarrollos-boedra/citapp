import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const { nombre, email, telefono, password, barberia_id } = await request.json();

  if (!nombre || !email || !password || !barberia_id) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: existente } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .eq("barberia_id", barberia_id)
    .maybeSingle();

  if (existente) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("usuarios")
    .insert({
      nombre,
      email,
      telefono: telefono ?? null,
      password: passwordHash,
      rol: "cliente",
      barberia_id,
    })
    .select("id, nombre, email")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
