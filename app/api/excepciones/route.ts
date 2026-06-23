import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth-guard";

// GET: público (el cliente necesita saber si un día tiene excepción al reservar)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberiaId = searchParams.get("barberia_id");
  if (!barberiaId) {
    return NextResponse.json({ error: "Falta barberia_id" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("excepciones")
    .select("id, fecha, cerrado, hora_inicio, hora_fin")
    .eq("barberia_id", barberiaId)
    .order("fecha")
    .order("hora_inicio");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST: solo admin. Guarda la excepción de UNA fecha concreta.
// Estrategia "reemplazar": borra lo que hubiera para esa fecha y mete lo nuevo.
// Body:
//   { fecha, cerrado: true }                              -> día cerrado
//   { fecha, cerrado: false, franjas: [{inicio, fin}, ...] } -> horario especial (1 o 2 franjas)
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  if (!body.fecha) {
    return NextResponse.json({ error: "Falta la fecha" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // 1. Borrar cualquier excepción previa de esa fecha (reemplazo limpio)
  const { error: delError } = await supabase
    .from("excepciones")
    .delete()
    .eq("barberia_id", barberiaId)
    .eq("fecha", body.fecha);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  // 2a. Día cerrado: una sola fila con cerrado=true, sin horas
  if (body.cerrado) {
    const { error } = await supabase.from("excepciones").insert({
      barberia_id: barberiaId,
      fecha: body.fecha,
      cerrado: true,
      hora_inicio: null,
      hora_fin: null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 2b. Horario especial: una fila por cada franja
  const franjas: { inicio: string; fin: string }[] = body.franjas ?? [];
  const franjasValidas = franjas.filter((f) => f.inicio && f.fin && f.fin > f.inicio);

  if (franjasValidas.length === 0) {
    return NextResponse.json(
      { error: "Indica al menos una franja válida (hora de fin mayor que la de inicio)." },
      { status: 400 },
    );
  }

  const filas = franjasValidas.map((f) => ({
    barberia_id: barberiaId,
    fecha: body.fecha,
    cerrado: false,
    hora_inicio: f.inicio,
    hora_fin: f.fin,
  }));

  const { error } = await supabase.from("excepciones").insert(filas);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: solo admin. Borra TODAS las excepciones de una fecha concreta.
// Body: { fecha }
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  if (!body.fecha) {
    return NextResponse.json({ error: "Falta la fecha" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("excepciones")
    .delete()
    .eq("barberia_id", barberiaId)
    .eq("fecha", body.fecha);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}