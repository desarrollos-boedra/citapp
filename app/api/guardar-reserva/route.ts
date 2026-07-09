import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth-guard";

// "HH:MM" (o "HH:MM:SS") -> minutos desde medianoche
function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.substring(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export async function POST(request: Request) {
  // El cliente debe estar logueado para reservar
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const supabase = supabaseAdmin();

  const { servicio_id, fecha_hora } = body;
  if (!servicio_id || !fecha_hora) {
    return NextResponse.json({ error: "Faltan datos de la reserva" }, { status: 400 });
  }

  // fecha_hora llega como "YYYY-MM-DD HH:MM"
  const fecha = fecha_hora.split(" ")[0];
  const hora = fecha_hora.split(" ")[1] ?? "";
  if (!fecha || !hora) {
    return NextResponse.json({ error: "Formato de fecha/hora no válido" }, { status: 400 });
  }

  // 1. Duración del servicio elegido
  const { data: servicio, error: servError } = await supabase
    .from("servicios")
    .select("duracion_min")
    .eq("id", servicio_id)
    .eq("barberia_id", guard.barberiaId)
    .single();
  if (servError || !servicio) {
    return NextResponse.json({ error: "Servicio no válido" }, { status: 400 });
  }
  const duracion = servicio.duracion_min ?? 30;

  const inicioMin = aMinutos(hora);
  const finMin = inicioMin + duracion;

  // 2. Comprobar solapamiento con OTRAS reservas no canceladas de ese día
  const { data: reservasDia, error: resError } = await supabase
    .from("reservas")
    .select("fecha_hora, servicio:servicio_id(duracion_min)")
    .eq("barberia_id", guard.barberiaId)
    .gte("fecha_hora", `${fecha} 00:00`)
    .lte("fecha_hora", `${fecha} 23:59`)
    .neq("estado", "cancelada");
  if (resError) {
    return NextResponse.json({ error: resError.message }, { status: 500 });
  }

  for (const r of reservasDia ?? []) {
    const rMin = aMinutos((r.fecha_hora as string).substring(11, 16));
    const rDur =
      (r.servicio as unknown as { duracion_min: number } | null)?.duracion_min ?? 30;
    const rFinMin = rMin + rDur;
    if (inicioMin < rFinMin && finMin > rMin) {
      return NextResponse.json(
        { error: "Esa hora ya no está disponible. Elige otra, por favor." },
        { status: 409 },
      );
    }
  }

  // 3. Comprobar solapamiento con BLOQUEOS de esa fecha (médico, etc.)
  const { data: bloqueosDia, error: bloqError } = await supabase
    .from("bloqueos")
    .select("hora_inicio, hora_fin")
    .eq("barberia_id", guard.barberiaId)
    .eq("fecha", fecha);
  if (bloqError) {
    return NextResponse.json({ error: bloqError.message }, { status: 500 });
  }

  for (const b of bloqueosDia ?? []) {
    const bMin = aMinutos(b.hora_inicio as string);
    const bFinMin = aMinutos(b.hora_fin as string);
    if (inicioMin < bFinMin && finMin > bMin) {
      return NextResponse.json(
        { error: "Esa hora no está disponible. Elige otra, por favor." },
        { status: 409 },
      );
    }
  }

  // 4. Todo libre: insertar. usuario_id y barberia_id salen del TOKEN.
  const { data, error } = await supabase
    .from("reservas")
    .insert({
      usuario_id: guard.userId,
      barberia_id: guard.barberiaId,
      servicio_id,
      fecha_hora,
      estado: "confirmada",
      notas: body.notas ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}