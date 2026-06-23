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
    .order("fecha");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST: solo admin. Crea una excepción para un día concreto.
// { fecha, cerrado, hora_inicio?, hora_fin? }
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  if (!body.fecha) {
    return NextResponse.json({ error: "Falta la fecha" }, { status: 400 });
  }

  // Si no está cerrado, debe traer horas válidas
  if (!body.cerrado) {
    if (!body.hora_inicio || !body.hora_fin || body.hora_fin <= body.hora_inicio) {
      return NextResponse.json(
        { error: "Si el día abre, indica una hora de inicio y fin válidas." },
        { status: 400 },
      );
    }
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("excepciones")
    .insert({
      barberia_id: barberiaId,
      fecha: body.fecha,
      cerrado: !!body.cerrado,
      hora_inicio: body.cerrado ? null : body.hora_inicio,
      hora_fin: body.cerrado ? null : body.hora_fin,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: solo admin. Borra una excepción por id (solo de su barbería).
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("excepciones")
    .delete()
    .eq("id", body.id)
    .eq("barberia_id", barberiaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}