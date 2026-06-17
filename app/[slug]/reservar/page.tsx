"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Servicio = {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion_min: number;
  precio: number;
  icono: string | null;
};

const PASOS = ["Servicio", "Fecha", "Confirmar"];

function getDiasDelMes(year: number, month: number) {
  const ultimoDia = new Date(year, month + 1, 0);
  const dias: (Date | null)[] = [];
  let inicioDia = new Date(year, month, 1).getDay();
  inicioDia = inicioDia === 0 ? 6 : inicioDia - 1;
  for (let i = 0; i < inicioDia; i++) dias.push(null);
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(year, month, d));
  return dias;
}

function fechaStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Horario simple: mañana 09:00-14:00, tarde 16:00-20:00, igual todos los días.
// El plan básico no soporta variación de horario por día de la semana.
function generarSlots(turno: string): string[] {
  const slots: string[] = [];
  const rangos =
    turno === "manana"
      ? [[9 * 60, 14 * 60]]
      : turno === "tarde"
        ? [[16 * 60, 20 * 60]]
        : [];
  for (const [inicio, fin] of rangos) {
    for (let min = inicio; min <= fin; min += 15) {
      const hh = String(Math.floor(min / 60)).padStart(2, "0");
      const mm = String(min % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

export default function ReservarPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [barberiaId, setBarberiaId] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<{ id: string; nombre: string; email: string } | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  const [paso, setPaso] = useState(0);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);
  const [horasDisponibles, setHorasDisponibles] = useState<{ hora: string; ocupada: boolean }[]>([]);
  const [horaSeleccionada, setHoraSeleccionada] = useState<string | null>(null);
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState("");
  const [mesVista, setMesVista] = useState(() => {
    const h = new Date();
    return { year: h.getFullYear(), month: h.getMonth() };
  });

  // Resolver slug -> barberia_id
  useEffect(() => {
    fetch(`/api/barberia/${slug}`)
      .then((r) => r.json())
      .then((data) => setBarberiaId(data.id ?? null));
  }, [slug]);

  // Comprobar sesión; si no hay, redirige a login
  useEffect(() => {
    async function comprobarSesion() {
      const res = await fetch("/api/auth/session");
      const session = await res.json();
      if (!session?.user) {
        router.push(`/${slug}/login?redirect=/${slug}/reservar`);
        return;
      }
      setUsuario({
        id: session.user.id,
        nombre: session.user.name ?? "",
        email: session.user.email ?? "",
      });
      setCargandoSesion(false);
    }
    comprobarSesion();
  }, [slug, router]);

  // Cargar servicios de la barbería
  useEffect(() => {
    if (!barberiaId) return;
    fetch(`/api/servicios?barberia_id=${barberiaId}`)
      .then((r) => r.json())
      .then((data) => setServicios(data));
  }, [barberiaId]);

  async function cargarHorarios(dia: Date) {
    if (!barberiaId) return;
    setCargandoHoras(true);
    setHoraSeleccionada(null);
    setHorasDisponibles([]);

    const fecha = fechaStr(dia);

    const resAgenda = await fetch(`/api/agenda?barberia_id=${barberiaId}`);
    const agendaTodas: { fecha: string; turno: string }[] = await resAgenda.json();
    const turnos = agendaTodas.filter((a) => a.fecha === fecha).map((a) => a.turno);

    if (turnos.length === 0 || turnos.includes("cerrado")) {
      setHorasDisponibles([]);
      setCargandoHoras(false);
      return;
    }

    let slots: string[] = [];
    if (turnos.includes("manana")) slots = [...slots, ...generarSlots("manana")];
    if (turnos.includes("tarde")) slots = [...slots, ...generarSlots("tarde")];

    // Reservas existentes ese día, para marcar ocupadas
    const resReservas = await fetch(
      `/api/reservas-dia?barberia_id=${barberiaId}&fecha=${fecha}`,
    );
    const reservasDia: { fecha_hora: string; duracion_min: number }[] = resReservas.ok
      ? await resReservas.json()
      : [];

    const duracionServicio = servicio?.duracion_min ?? 30;

    const ocupado = (slot: string) => {
      const [sh, sm] = slot.split(":").map(Number);
      const slotMin = sh * 60 + sm;
      const slotFinMin = slotMin + duracionServicio;
      for (const r of reservasDia) {
        const horaR = r.fecha_hora.substring(11, 16);
        const [rh, rm] = horaR.split(":").map(Number);
        const rMin = rh * 60 + rm;
        const rFinMin = rMin + (r.duracion_min ?? 30);
        if (slotMin < rFinMin && slotFinMin > rMin) return true;
      }
      return false;
    };

    const ahora = new Date();
    const esHoy = fechaStr(ahora) === fecha;

    setHorasDisponibles(
      slots
        .filter((h) => {
          if (esHoy) {
            const [hh, mm] = h.split(":").map(Number);
            if (hh * 60 + mm <= ahora.getHours() * 60 + ahora.getMinutes()) return false;
          }
          return true;
        })
        .map((h) => ({ hora: h, ocupada: ocupado(h) })),
    );
    setCargandoHoras(false);
  }

  async function confirmarReserva() {
    if (!servicio || !diaSeleccionado || !horaSeleccionada || !barberiaId || !usuario) return;
    setLoading(true);
    setError("");

    const fecha = fechaStr(diaSeleccionado);
    const fechaHoraStr = `${fecha} ${horaSeleccionada}`;

    const res = await fetch("/api/guardar-reserva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario_id: usuario.id,
        servicio_id: servicio.id,
        barberia_id: barberiaId,
        fecha_hora: fechaHoraStr,
        estado: "confirmada",
        notas: `Cliente: ${usuario.nombre}.`,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Ha ocurrido un error. Inténtalo de nuevo.");
      return;
    }

    setExito(true);
  }

  if (cargandoSesion) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <svg className="animate-spin h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (exito) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
        <div className="text-center max-w-sm w-full">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-3xl">
            ✓
          </div>
          <h2 className="text-white text-2xl font-bold mb-3">¡Reserva confirmada!</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            Tu cita ha sido registrada correctamente.
          </p>
          <Link
            href={`/${slug}`}
            className="block w-full bg-gradient-to-br from-purple-400 to-purple-600 text-zinc-950 font-bold py-3.5 rounded-[14px] text-sm"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="flex items-center px-6 py-4 border-b border-white/5">
        <Link href={`/${slug}`} className="text-zinc-400 text-sm">
          ← Volver
        </Link>
      </nav>

      <div className="flex items-center justify-center px-6 py-5 gap-2">
        {PASOS.map((p, i) => (
          <div
            key={p}
            className={`text-[11px] font-semibold px-3 py-1 rounded-full ${
              i === paso ? "bg-purple-500/20 text-purple-300" : "text-zinc-600"
            }`}
          >
            {p}
          </div>
        ))}
      </div>

      <main className="px-6 pb-10 max-w-lg mx-auto">
        {paso === 0 && (
          <div>
            <h2 className="text-white text-2xl font-bold mb-1">¿Qué necesitas?</h2>
            <p className="text-zinc-500 text-sm mb-6">Elige el servicio que quieres</p>
            <div className="grid grid-cols-2 gap-3">
              {servicios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setServicio(s);
                    setPaso(1);
                  }}
                  className="p-4 rounded-[16px] border border-white/[0.07] bg-white/[0.025] text-left hover:border-purple-500/30 transition-all duration-200"
                >
                  {s.icono && <div className="text-2xl mb-2">{s.icono}</div>}
                  <div className="text-white text-sm font-semibold mb-1">{s.nombre}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-purple-400 font-bold">{s.precio}€</span>
                    <span className="text-zinc-600 text-[11px]">{s.duracion_min}min</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {paso === 1 && (
          <div>
            <button onClick={() => setPaso(0)} className="text-zinc-500 text-sm mb-5">
              ← Volver
            </button>
            <h2 className="text-white text-2xl font-bold mb-1">¿Qué día y hora?</h2>
            <p className="text-zinc-500 text-sm mb-6">Selecciona el día y tu horario</p>

            <div className="bg-white/[0.025] border border-white/[0.07] rounded-[20px] p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() =>
                    setMesVista((p) => {
                      const d = new Date(p.year, p.month - 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })
                  }
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-zinc-400"
                >
                  ‹
                </button>
                <span className="text-white text-sm font-semibold capitalize">
                  {new Date(mesVista.year, mesVista.month).toLocaleDateString("es-ES", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button
                  onClick={() =>
                    setMesVista((p) => {
                      const d = new Date(p.year, p.month + 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })
                  }
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-zinc-400"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 mb-1">
                {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => (
                  <div key={d} className="text-center text-[10px] text-zinc-600 font-semibold py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getDiasDelMes(mesVista.year, mesVista.month).map((d, i) => {
                  if (!d) return <div key={i} />;
                  const hoy = new Date();
                  hoy.setHours(0, 0, 0, 0);
                  const esPasado = d < hoy;
                  const fs = fechaStr(d);
                  const seleccionado = diaSeleccionado ? fechaStr(diaSeleccionado) === fs : false;
                  return (
                    <button
                      key={i}
                      disabled={esPasado}
                      onClick={() => {
                        setDiaSeleccionado(d);
                        cargarHorarios(d);
                      }}
                      className={`aspect-square rounded-[8px] text-[12px] font-semibold ${
                        esPasado
                          ? "text-zinc-700 cursor-not-allowed"
                          : seleccionado
                            ? "bg-purple-500 text-zinc-950"
                            : "text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {diaSeleccionado && (
              <div className="mb-6">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                  Hora disponible
                </p>
                {cargandoHoras ? (
                  <div className="flex justify-center py-8">
                    <svg className="animate-spin h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : horasDisponibles.length === 0 ? (
                  <div className="text-center py-8 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                    <p className="text-zinc-500 text-sm">No hay horas disponibles</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {horasDisponibles.map(({ hora, ocupada }) => (
                      <button
                        key={hora}
                        disabled={ocupada}
                        onClick={() => setHoraSeleccionada(hora)}
                        className={`py-2.5 rounded-[12px] border text-[13px] font-medium ${
                          ocupada
                            ? "border-white/[0.04] bg-white/[0.02] text-zinc-700 cursor-not-allowed"
                            : horaSeleccionada === hora
                              ? "border-purple-500 bg-purple-500/15 text-purple-300"
                              : "border-white/[0.07] bg-white/[0.025] text-zinc-300"
                        }`}
                      >
                        {hora}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => diaSeleccionado && horaSeleccionada && setPaso(2)}
              disabled={!diaSeleccionado || !horaSeleccionada}
              className="w-full bg-gradient-to-br from-purple-400 to-purple-600 disabled:opacity-30 text-zinc-950 font-bold py-4 rounded-[14px]"
            >
              Continuar
            </button>
          </div>
        )}

        {paso === 2 && (
          <div>
            <button onClick={() => setPaso(1)} className="text-zinc-500 text-sm mb-5">
              ← Volver
            </button>
            <h2 className="text-white text-2xl font-bold mb-1">Confirmar reserva</h2>
            <p className="text-zinc-500 text-sm mb-6">Revisa los detalles antes de confirmar</p>

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl px-6 py-4 space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Servicio</span>
                <span className="text-white">{servicio?.nombre}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Día</span>
                <span className="text-white">
                  {diaSeleccionado?.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Hora</span>
                <span className="text-white">{horaSeleccionada}</span>
              </div>
              <div className="pt-3 border-t border-white/5 flex justify-between">
                <span className="text-zinc-400 font-semibold">Total</span>
                <span className="text-purple-400 font-bold text-lg">{servicio?.precio}€</span>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <button
              onClick={confirmarReserva}
              disabled={loading}
              className="w-full bg-gradient-to-br from-purple-400 to-purple-600 disabled:opacity-50 text-zinc-950 font-bold py-4 rounded-[14px]"
            >
              {loading ? "Confirmando..." : "Confirmar reserva"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
