import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth-guard";

// GET: público (el cliente necesita el horario para ver disponibilidad al reservar)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberiaId = searchParams.get("barberia_id");
  if (!barberiaId) {
    return NextResponse.json({ error: "Falta barberia_id" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("horario_semanal")
    .select("id, dia_semana, hora_inicio, hora_fin")
    .eq("barberia_id", barberiaId)
    .order("dia_semana")
    .order("hora_inicio");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PUT: solo admin. Reemplaza TODO el horario semanal de la barbería de una vez.
// Recibe { franjas: [{ dia_semana, hora_inicio, hora_fin }, ...] }
// Borra el horario anterior y mete el nuevo (más simple y fiable que actualizar fila a fila).
export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  const franjas: { dia_semana: number; hora_inicio: string; hora_fin: string }[] =
    body.franjas ?? [];

  // Validación básica de cada franja
  for (const f of franjas) {
    if (
      typeof f.dia_semana !== "number" ||
      f.dia_semana < 0 ||
      f.dia_semana > 6 ||
      !f.hora_inicio ||
      !f.hora_fin ||
      f.hora_fin <= f.hora_inicio
    ) {
      return NextResponse.json(
        { error: "Hay una franja con datos inválidos (revisa que la hora de fin sea mayor que la de inicio)." },
        { status: 400 },
      );
    }
  }

  const supabase = supabaseAdmin();

  // 1. Borrar el horario actual de esta barbería
  const { error: delError } = await supabase
    .from("horario_semanal")
    .delete()
    .eq("barberia_id", barberiaId);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  // 2. Insertar el nuevo (si hay franjas)
  if (franjas.length > 0) {
    const filas = franjas.map((f) => ({
      barberia_id: barberiaId,
      dia_semana: f.dia_semana,
      hora_inicio: f.hora_inicio,
      hora_fin: f.hora_fin,
    }));
    const { error: insError } = await supabase.from("horario_semanal").insert(filas);
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}