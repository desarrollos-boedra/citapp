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

type FranjaHorario = { dia_semana: number; hora_inicio: string; hora_fin: string };
type Excepcion = {
  fecha: string;
  cerrado: boolean;
  hora_inicio: string | null;
  hora_fin: string | null;
};

type Bloqueo = {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
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

// "HH:MM" -> minutos desde medianoche
function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.substring(0, 5).split(":").map(Number);
  return h * 60 + m;
}

// minutos -> "HH:MM"
function aHora(min: number): string {
  const hh = String(Math.floor(min / 60)).padStart(2, "0");
  const mm = String(min % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Día de la semana (0=lunes..6=domingo) de un Date
function diaSemana(d: Date): number {
  return (d.getDay() + 6) % 7;
}

// Genera puntos de inicio (cada INTERVALO_MIN) dentro de una franja,
// asegurando que un servicio de `duracion` minutos cabe antes del fin.
function generarSlotsDeFranja(inicioMin: number, finMin: number, duracion: number, intervalo: number): string[] {
  const slots: string[] = [];
  for (let min = inicioMin; min + duracion <= finMin; min += intervalo) {
    slots.push(aHora(min));
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
  const [cargandoServicios, setCargandoServicios] = useState(true);

  // Horarios del negocio (se cargan una vez)
  const [horarioSemanal, setHorarioSemanal] = useState<FranjaHorario[]>([]);
  const [excepciones, setExcepciones] = useState<Excepcion[]>([]);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [intervalo, setIntervalo] = useState(30);

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

  // Cargar servicios + horario semanal + excepciones de la barbería
  useEffect(() => {
    if (!barberiaId) return;
    fetch(`/api/servicios?barberia_id=${barberiaId}`)
      .then((r) => r.json())
      .then((data) => {
        setServicios(data);
        setCargandoServicios(false);
      });

    fetch(`/api/horario-semanal?barberia_id=${barberiaId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setHorarioSemanal(data));

    fetch(`/api/excepciones?barberia_id=${barberiaId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setExcepciones(data));

    fetch(`/api/bloqueos?barberia_id=${barberiaId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBloqueos(data));

    fetch(`/api/intervalo?barberia_id=${barberiaId}`)
      .then((r) => (r.ok ? r.json() : { intervalo_min: 30 }))
      .then((data) => setIntervalo(data.intervalo_min ?? 30));
  }, [barberiaId]);

  // Devuelve las franjas [inicioMin, finMin] que aplican a una fecha concreta,
  // teniendo en cuenta excepciones (que tienen prioridad) y, si no, el horario semanal.
  function franjasDeFecha(dia: Date): [number, number][] {
    const fecha = fechaStr(dia);

    // 1. ¿Hay excepción para esta fecha?
    const excDia = excepciones.filter((e) => e.fecha === fecha);
    if (excDia.length > 0) {
      // Si alguna marca cerrado, el día está cerrado
      if (excDia.some((e) => e.cerrado)) return [];
      // Si no, usar las franjas de la excepción
      return excDia
        .filter((e) => e.hora_inicio && e.hora_fin)
        .map((e) => [aMinutos(e.hora_inicio as string), aMinutos(e.hora_fin as string)] as [number, number]);
    }

    // 2. Sin excepción: usar el horario semanal del día de la semana
    const ds = diaSemana(dia);
    return horarioSemanal
      .filter((f) => f.dia_semana === ds)
      .map((f) => [aMinutos(f.hora_inicio), aMinutos(f.hora_fin)] as [number, number]);
  }

  async function cargarHorarios(dia: Date) {
    if (!barberiaId) return;
    setCargandoHoras(true);
    setHoraSeleccionada(null);
    setHorasDisponibles([]);

    const fecha = fechaStr(dia);
    const duracionServicio = servicio?.duracion_min ?? 30;

    // Franjas de apertura de ese día (semanal o excepción)
    const franjas = franjasDeFecha(dia);

    if (franjas.length === 0) {
      setHorasDisponibles([]);
      setCargandoHoras(false);
      return;
    }

    // Generar todos los slots posibles donde el servicio cabe
    let slots: string[] = [];
    for (const [ini, fin] of franjas) {
      slots = [...slots, ...generarSlotsDeFranja(ini, fin, duracionServicio, intervalo)];
    }

    // Reservas existentes ese día, para marcar ocupadas
    const resReservas = await fetch(
      `/api/reservas-dia?barberia_id=${barberiaId}&fecha=${fecha}`,
    );
    const reservasDia: { fecha_hora: string; duracion_min: number }[] = resReservas.ok
      ? await resReservas.json()
      : [];

    const bloqueosDia = bloqueos.filter((b) => b.fecha === fecha);

    const ocupado = (slot: string) => {
      const slotMin = aMinutos(slot);
      const slotFinMin = slotMin + duracionServicio;
      // Reservas existentes
      for (const r of reservasDia) {
        const rMin = aMinutos(r.fecha_hora.substring(11, 16));
        const rFinMin = rMin + (r.duracion_min ?? 30);
        if (slotMin < rFinMin && slotFinMin > rMin) return true;
      }
      // Bloqueos puntuales (médico, etc.)
      for (const b of bloqueosDia) {
        const bMin = aMinutos(b.hora_inicio);
        const bFinMin = aMinutos(b.hora_fin);
        if (slotMin < bFinMin && slotFinMin > bMin) return true;
      }
      return false;
    };

    const ahora = new Date();
    const esHoy = fechaStr(ahora) === fecha;
    const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();

    setHorasDisponibles(
      slots
        .filter((h) => {
          // Si es hoy, descartar horas ya pasadas
          if (esHoy && aMinutos(h) <= ahoraMin) return false;
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
        servicio_id: servicio.id,
        fecha_hora: fechaHoraStr,
        notas: `Cliente: ${usuario.nombre}.`,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Ha ocurrido un error. Inténtalo de nuevo.");
      return;
    }

    setExito(true);
  }

  if (cargandoSesion || cargandoServicios) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <svg className="h-6 w-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (exito) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-primary text-2xl text-primary-foreground">
            ✓
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">¡Reserva confirmada!</h2>
          <p className="mx-auto mt-2 mb-8 max-w-xs text-sm text-muted-foreground">
            Tu cita ha sido registrada correctamente.
          </p>
          <Link
            href={`/${slug}`}
            className="block w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center px-5 py-3.5">
          <Link
            href={`/${slug}`}
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            ← Volver
          </Link>
        </div>
      </header>

      {/* Stepper de círculos */}
      <div className="mx-auto flex max-w-xs items-center justify-between px-5 py-6">
        {PASOS.map((p, i) => (
          <div key={p} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold transition ${
                  i <= paso
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
            </div>
            {i < PASOS.length - 1 && (
              <div
                className={`mx-1 h-px flex-1 transition ${i < paso ? "bg-primary" : "bg-border"}`}
              />
            )}
          </div>
        ))}
      </div>

      <main className="mx-auto max-w-lg px-5 pb-12">
        {/* PASO 0: Servicio */}
        {paso === 0 && (
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Elige un servicio</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecciona el servicio que quieres reservar.
            </p>
            <div className="mt-6 space-y-3">
              {servicios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setServicio(s);
                    setPaso(1);
                  }}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-soft transition hover:border-ring/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {s.icono && <span className="text-xl">{s.icono}</span>}
                      <span className="font-semibold">{s.nombre}</span>
                    </div>
                    <span className="shrink-0 font-semibold text-primary">{s.precio} €</span>
                  </div>
                  {s.descripcion && (
                    <p className="mt-2 text-sm text-muted-foreground">{s.descripcion}</p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">{s.duracion_min} min</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASO 1: Fecha y hora */}
        {paso === 1 && (
          <div>
            <button
              onClick={() => setPaso(0)}
              className="mb-5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              ← Volver
            </button>
            <h2 className="text-xl font-semibold tracking-tight">¿Qué día y hora?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Selecciona el día y tu horario.</p>

            {/* Calendario */}
            <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() =>
                    setMesVista((p) => {
                      const d = new Date(p.year, p.month - 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })
                  }
                  disabled={mesVista.year === new Date().getFullYear() && mesVista.month === new Date().getMonth()}
                  className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-background"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold capitalize">
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
                  className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-secondary"
                >
                  ›
                </button>
              </div>
              <div className="mb-1 grid grid-cols-7">
                {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => (
                  <div key={d} className="py-1 text-center text-[10px] font-semibold text-muted-foreground">
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
                  const cerrado = !esPasado && franjasDeFecha(d).length === 0;
                  return (
                    <button
                      key={i}
                      disabled={esPasado || cerrado}
                      onClick={() => {
                        setDiaSeleccionado(d);
                        cargarHorarios(d);
                      }}
                      className={`aspect-square rounded-lg text-sm font-semibold transition ${
                        esPasado || cerrado
                          ? "cursor-not-allowed text-muted-foreground/40"
                          : seleccionado
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horas */}
            {diaSeleccionado && (
              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Hora disponible
                </p>
                {cargandoHoras ? (
                  <div className="flex justify-center py-8">
                    <svg className="h-5 w-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : horasDisponibles.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card py-8 text-center">
                    <p className="text-sm text-muted-foreground">No hay horas disponibles</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {horasDisponibles.map(({ hora, ocupada }) => (
                      <button
                        key={hora}
                        disabled={ocupada}
                        onClick={() => setHoraSeleccionada(hora)}
                        className={`rounded-lg border py-2.5 text-sm font-medium transition ${
                          ocupada
                            ? "cursor-not-allowed border-border bg-muted text-muted-foreground/40"
                            : horaSeleccionada === hora
                              ? "border-primary bg-accent text-accent-foreground"
                              : "border-border bg-card text-foreground hover:border-ring/40"
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
              className="mt-6 w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
            </button>
          </div>
        )}

        {/* PASO 2: Confirmar */}
        {paso === 2 && (
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Confirma tu reserva</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Revisa los detalles antes de confirmar.
            </p>

            <div className="mt-6 space-y-2.5">
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-soft">
                <span className="text-sm text-muted-foreground">Servicio</span>
                <span className="text-sm font-medium">{servicio?.nombre}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-soft">
                <span className="text-sm text-muted-foreground">Duración</span>
                <span className="text-sm font-medium">{servicio?.duracion_min} min</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-soft">
                <span className="text-sm text-muted-foreground">Día</span>
                <span className="text-sm font-medium capitalize">
                  {diaSeleccionado?.toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-soft">
                <span className="text-sm text-muted-foreground">Hora</span>
                <span className="text-sm font-medium">{horaSeleccionada}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-soft">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">{servicio?.precio} €</span>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setPaso(1)}
                className="rounded-md border border-border bg-background px-5 py-3 text-sm font-medium shadow-soft transition hover:bg-secondary"
              >
                Atrás
              </button>
              <button
                onClick={confirmarReserva}
                disabled={loading}
                className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Confirmando..." : "Confirmar reserva"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}