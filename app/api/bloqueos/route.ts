import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth-guard";

// GET público: bloqueos por barberia_id (para la página de reserva)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberiaId = searchParams.get("barberia_id");
  if (!barberiaId) {
    return NextResponse.json({ error: "Falta barberia_id" }, { status: 400 });
  }
  const supabase = supabaseAdmin();
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("bloqueos")
    .select("id, fecha, hora_inicio, hora_fin, motivo")
    .eq("barberia_id", barberiaId)
    .gte("fecha", hoyStr)
    .order("fecha", { ascending: true })
    .order("hora_inicio", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST admin: crear bloqueo
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  const { fecha, hora_inicio, hora_fin, motivo } = body;

  if (!fecha || !hora_inicio || !hora_fin) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (hora_inicio >= hora_fin) {
    return NextResponse.json({ error: "La hora de fin debe ser posterior al inicio" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("bloqueos").insert({
    barberia_id: barberiaId,
    fecha,
    hora_inicio,
    hora_fin,
    motivo: motivo || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE admin: borrar bloqueo por id
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("bloqueos")
    .delete()
    .eq("id", id)
    .eq("barberia_id", barberiaId); // seguridad: solo borra si es suyo
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}