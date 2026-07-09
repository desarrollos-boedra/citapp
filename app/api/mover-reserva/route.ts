import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth-guard";

// "HH:MM" (o "HH:MM:SS") -> minutos desde medianoche
function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.substring(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  const { id, fecha_hora } = body;
  if (!id || !fecha_hora) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const fecha = fecha_hora.split(" ")[0];
  const hora = fecha_hora.split(" ")[1] ?? "";
  if (!fecha || !hora) {
    return NextResponse.json({ error: "Formato de fecha/hora no válido" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // 1. La reserva a mover debe existir, ser de esta barbería y estar confirmada
  const { data: reserva, error: rError } = await supabase
    .from("reservas")
    .select("id, estado, servicio:servicio_id(duracion_min)")
    .eq("id", id)
    .eq("barberia_id", barberiaId)
    .single();
  if (rError || !reserva) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }
  if (reserva.estado !== "confirmada") {
    return NextResponse.json({ error: "Solo se pueden mover citas confirmadas" }, { status: 400 });
  }

  const duracion =
    (reserva.servicio as unknown as { duracion_min: number } | null)?.duracion_min ?? 30;
  const inicioMin = aMinutos(hora);
  const finMin = inicioMin + duracion;

  // 2. Comprobar solape con OTRAS reservas activas del día destino (excluyendo la propia)
  const { data: reservasDia, error: resError } = await supabase
    .from("reservas")
    .select("id, fecha_hora, servicio:servicio_id(duracion_min)")
    .eq("barberia_id", barberiaId)
    .gte("fecha_hora", `${fecha} 00:00`)
    .lte("fecha_hora", `${fecha} 23:59`)
    .neq("estado", "cancelada");
  if (resError) {
    return NextResponse.json({ error: resError.message }, { status: 500 });
  }

  for (const r of reservasDia ?? []) {
    if (r.id === id) continue; // no compararse consigo misma
    const rMin = aMinutos((r.fecha_hora as string).substring(11, 16));
    const rDur =
      (r.servicio as unknown as { duracion_min: number } | null)?.duracion_min ?? 30;
    const rFinMin = rMin + rDur;
    if (inicioMin < rFinMin && finMin > rMin) {
      return NextResponse.json(
        { error: "Ese hueco está ocupado por otra cita." },
        { status: 409 },
      );
    }
  }

  // 3. Comprobar solape con bloqueos de la fecha destino
  const { data: bloqueosDia, error: bError } = await supabase
    .from("bloqueos")
    .select("hora_inicio, hora_fin")
    .eq("barberia_id", barberiaId)
    .eq("fecha", fecha);
  if (bError) {
    return NextResponse.json({ error: bError.message }, { status: 500 });
  }
  for (const b of bloqueosDia ?? []) {
    const bMin = aMinutos(b.hora_inicio as string);
    const bFinMin = aMinutos(b.hora_fin as string);
    if (inicioMin < bFinMin && finMin > bMin) {
      return NextResponse.json(
        { error: "Ese hueco está bloqueado." },
        { status: 409 },
      );
    }
  }

  // 4. Todo libre: actualizar la fecha_hora
  const { error: updError } = await supabase
    .from("reservas")
    .update({ fecha_hora })
    .eq("id", id)
    .eq("barberia_id", barberiaId);
  if (updError) {
    return NextResponse.json({ error: updError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}