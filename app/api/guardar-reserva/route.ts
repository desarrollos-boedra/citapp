import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth-guard";

export async function POST(request: Request) {
  // El cliente debe estar logueado para reservar
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const supabase = supabaseAdmin();

  // usuario_id y barberia_id salen del TOKEN, no del body.
  // Así un usuario no puede crear reservas en nombre de otro ni en otra barbería.
  const { data, error } = await supabase
    .from("reservas")
    .insert({
      usuario_id: guard.userId,
      barberia_id: guard.barberiaId,
      servicio_id: body.servicio_id,
      fecha_hora: body.fecha_hora,
      estado: "confirmada",
      notas: body.notas ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}