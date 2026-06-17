import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberiaId = searchParams.get("barberia_id");
  if (!barberiaId) {
    return NextResponse.json({ error: "Falta barberia_id" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("servicios")
    .select("id, nombre, descripcion, duracion_min, precio, icono")
    .eq("barberia_id", barberiaId)
    .eq("activo", true)
    .order("orden");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("servicios").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, ...resto } = body;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("servicios").update(resto).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("servicios").update({ activo: false }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
