import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth-guard";

const LIMITE_PLAN_BASICO = 4;

// GET: público (la home y el flujo de reserva muestran los servicios)
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

// POST: solo admin. barberia_id del token. Respeta el límite de 4 servicios activos.
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const supabase = supabaseAdmin();

  // Comprobar el límite del plan básico (máx 4 servicios activos)
  const { count } = await supabase
    .from("servicios")
    .select("id", { count: "exact", head: true })
    .eq("barberia_id", barberiaId)
    .eq("activo", true);

  if ((count ?? 0) >= LIMITE_PLAN_BASICO) {
    return NextResponse.json(
      { error: `El plan Básico permite un máximo de ${LIMITE_PLAN_BASICO} servicios.` },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from("servicios")
    .insert({
      barberia_id: barberiaId, // del token, no del body
      nombre: body.nombre,
      descripcion: body.descripcion ?? null,
      precio: body.precio,
      duracion_min: body.duracion_min,
      icono: body.icono ?? null,
      activo: true,
      orden: body.orden ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH: solo admin. Solo puede editar servicios de SU barbería.
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  const { id, barberia_id: _ignore, ...resto } = body;
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("servicios")
    .update(resto)
    .eq("id", id)
    .eq("barberia_id", barberiaId); // no puede tocar servicios de otra barbería
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: solo admin. Soft-delete (activo=false) solo de SU barbería.
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("servicios")
    .update({ activo: false })
    .eq("id", body.id)
    .eq("barberia_id", barberiaId); // no puede borrar servicios de otra barbería
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}