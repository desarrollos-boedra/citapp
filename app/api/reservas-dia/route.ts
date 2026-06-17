import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberiaId = searchParams.get("barberia_id");
  const fecha = searchParams.get("fecha");

  if (!barberiaId || !fecha) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reservas")
    .select("fecha_hora, servicio:servicio_id(duracion_min)")
    .eq("barberia_id", barberiaId)
    .gte("fecha_hora", `${fecha} 00:00`)
    .lte("fecha_hora", `${fecha} 23:59`)
    .neq("estado", "cancelada");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const resultado = (data ?? []).map((r) => ({
    fecha_hora: r.fecha_hora,
    duracion_min: (r.servicio as unknown as { duracion_min: number } | null)?.duracion_min ?? 30,
  }));

  return NextResponse.json(resultado);
}
