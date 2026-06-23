import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth-guard";

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Solo cancela si la reserva pertenece a la barbería del admin.
  // El .eq("barberia_id") impide cancelar reservas de otra barbería.
  const { data, error } = await supabase
    .from("reservas")
    .update({ estado: "cancelada" })
    .eq("id", id)
    .eq("barberia_id", barberiaId)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si no se actualizó ninguna fila, la reserva no era de esta barbería
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}