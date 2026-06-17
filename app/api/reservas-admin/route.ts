import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberiaId = searchParams.get("barberia_id");
  if (!barberiaId) {
    return NextResponse.json({ error: "Falta barberia_id" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Marcar como completadas las confirmadas que ya pasaron
  const ahora = new Date();
  const ahoraStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")} ${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  await supabase
    .from("reservas")
    .update({ estado: "completada" })
    .eq("estado", "confirmada")
    .eq("barberia_id", barberiaId)
    .lt("fecha_hora", ahoraStr);

  const { data, error } = await supabase
    .from("reservas")
    .select("id, fecha_hora, estado, notas, servicio:servicio_id(nombre, precio, duracion_min)")
    .eq("barberia_id", barberiaId)
    .order("fecha_hora", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
