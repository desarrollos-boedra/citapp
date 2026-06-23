import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth-guard";

// GET: público (el cliente necesita ver los turnos disponibles para reservar)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberiaId = searchParams.get("barberia_id");
  if (!barberiaId) {
    return NextResponse.json({ error: "Falta barberia_id" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("agenda")
    .select("fecha, turno")
    .eq("barberia_id", barberiaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST: solo admin. La barberia_id sale del token, NO del body.
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json(); // { fecha, turno } — ignoramos cualquier barberia_id del body
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("agenda").insert({
    barberia_id: barberiaId,
    fecha: body.fecha,
    turno: body.turno,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: solo admin. La barberia_id sale del token.
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json(); // { fecha, turno }
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("agenda")
    .delete()
    .eq("barberia_id", barberiaId)
    .eq("fecha", body.fecha)
    .eq("turno", body.turno);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}