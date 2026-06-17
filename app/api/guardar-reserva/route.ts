import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const body = await request.json();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("reservas").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const body = await request.json();

  const supabase = supabaseAdmin();

  // Actualización masiva por filtros (ej: marcar como completadas las pasadas)
  if (body.filtro_estado && body.filtro_barberia && body.filtro_fecha) {
    const { error } = await supabase
      .from("reservas")
      .update({ estado: body.estado })
      .eq("estado", body.filtro_estado)
      .eq("barberia_id", body.filtro_barberia)
      .lt("fecha_hora", body.filtro_fecha);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Actualización individual por id
  const { id, ...resto } = body;
  const { error } = await supabase.from("reservas").update(resto).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
