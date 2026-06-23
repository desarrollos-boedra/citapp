"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

type Reserva = {
  id: string;
  fecha_hora: string;
  estado: string;
  notas: string | null;
  servicio: { nombre: string; precio: number; duracion_min: number } | null;
};

type Servicio = {
  id: string;
  nombre: string;
  precio: number;
  duracion_min: number;
  activo: boolean;
};

type Franja = { dia_semana: number; hora_inicio: string; hora_fin: string };
type Excepcion = {
  id: string;
  fecha: string;
  cerrado: boolean;
  hora_inicio: string | null;
  hora_fin: string | null;
};

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const LIMITE_SERVICIOS = 4;

function formatFechaHora(str: string) {
  const [fecha, hora] = str.split(" ");
  const [y, m, d] = fecha.split("-");
  const fechaObj = new Date(Number(y), Number(m) - 1, Number(d));
  return {
    fecha: fechaObj.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }),
    hora: hora ?? "",
  };
}

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split("-");
  const obj = new Date(Number(y), Number(m) - 1, Number(d));
  return obj.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function AdminPage() {
  const router = useRouter();
  const [barberiaId, setBarberiaId] = useState<string | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [tab, setTab] = useState<"reservas" | "horario" | "servicios">("reservas");
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: "ok" | "error" } | null>(null);

  // Reservas
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("confirmada");

  // Horario semanal: por cada día, una franja mañana y una tarde (opcionales)
  const [horarioDias, setHorarioDias] = useState<
    { manana: { inicio: string; fin: string } | null; tarde: { inicio: string; fin: string } | null }[]
  >(() => DIAS.map(() => ({ manana: null, tarde: null })));
  const [excepciones, setExcepciones] = useState<Excepcion[]>([]);
  const [guardandoHorario, setGuardandoHorario] = useState(false);

  // Nueva excepción
  const [excFecha, setExcFecha] = useState("");
  const [excCerrado, setExcCerrado] = useState(true);
  const [excInicio, setExcInicio] = useState("09:00");
  const [excFin, setExcFin] = useState("14:00");

  // Servicios
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [nuevaDuracion, setNuevaDuracion] = useState("");

  function notificar(texto: string, tipo: "ok" | "error" = "ok") {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 3000);
  }

  useEffect(() => {
    async function comprobarSesion() {
      const res = await fetch("/api/auth/session");
      const session = await res.json();
      if (!session?.user || session.user.rol !== "admin") {
        router.push("/");
        return;
      }
      setBarberiaId(session.user.barberia_id);
      setCargandoSesion(false);
    }
    comprobarSesion();
  }, [router]);

  const cargarReservas = useCallback(async () => {
    setLoadingReservas(true);
    const res = await fetch("/api/reservas-admin");
    if (res.ok) setReservas(await res.json());
    setLoadingReservas(false);
  }, []);

  const cargarHorario = useCallback(async () => {
    if (!barberiaId) return;
    // Horario semanal
    const resH = await fetch(`/api/horario-semanal?barberia_id=${barberiaId}`);
    const franjas: Franja[] = resH.ok ? await resH.json() : [];
    const dias = DIAS.map(() => ({
      manana: null as { inicio: string; fin: string } | null,
      tarde: null as { inicio: string; fin: string } | null,
    }));
    // Asignar la primera franja de cada día a "mañana" y la segunda a "tarde"
    for (const f of franjas) {
      const ini = f.hora_inicio.substring(0, 5);
      const fin = f.hora_fin.substring(0, 5);
      if (!dias[f.dia_semana].manana) dias[f.dia_semana].manana = { inicio: ini, fin };
      else dias[f.dia_semana].tarde = { inicio: ini, fin };
    }
    setHorarioDias(dias);

    // Excepciones
    const resE = await fetch(`/api/excepciones?barberia_id=${barberiaId}`);
    if (resE.ok) setExcepciones(await resE.json());
  }, [barberiaId]);

  const cargarServicios = useCallback(async () => {
    if (!barberiaId) return;
    const res = await fetch(`/api/servicios?barberia_id=${barberiaId}`);
    if (res.ok) setServicios(await res.json());
  }, [barberiaId]);

  useEffect(() => {
    if (!barberiaId) return;
    if (tab === "reservas") cargarReservas();
    if (tab === "horario") cargarHorario();
    if (tab === "servicios") cargarServicios();
  }, [tab, barberiaId, cargarReservas, cargarHorario, cargarServicios]);

  async function cancelarReserva(id: string) {
    setReservas((prev) => prev.map((r) => (r.id === id ? { ...r, estado: "cancelada" } : r)));
    const res = await fetch("/api/cancelar-reserva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) notificar("Reserva cancelada");
    else notificar("No se pudo cancelar", "error");
  }

  // --- Horario semanal ---
  function setFranja(diaIdx: number, turno: "manana" | "tarde", campo: "inicio" | "fin", valor: string) {
    setHorarioDias((prev) => {
      const copia = prev.map((d) => ({ ...d }));
      const actual = copia[diaIdx][turno] ?? { inicio: "", fin: "" };
      copia[diaIdx][turno] = { ...actual, [campo]: valor };
      return copia;
    });
  }

  function toggleTurno(diaIdx: number, turno: "manana" | "tarde") {
    setHorarioDias((prev) => {
      const copia = prev.map((d) => ({ ...d }));
      if (copia[diaIdx][turno]) {
        copia[diaIdx][turno] = null;
      } else {
        copia[diaIdx][turno] =
          turno === "manana" ? { inicio: "09:30", fin: "13:45" } : { inicio: "16:00", fin: "20:00" };
      }
      return copia;
    });
  }

  async function guardarHorario() {
    setGuardandoHorario(true);
    const franjas: Franja[] = [];
    horarioDias.forEach((d, idx) => {
      if (d.manana) franjas.push({ dia_semana: idx, hora_inicio: d.manana.inicio, hora_fin: d.manana.fin });
      if (d.tarde) franjas.push({ dia_semana: idx, hora_inicio: d.tarde.inicio, hora_fin: d.tarde.fin });
    });
    const res = await fetch("/api/horario-semanal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ franjas }),
    });
    setGuardandoHorario(false);
    if (res.ok) notificar("Horario guardado");
    else {
      const data = await res.json();
      notificar(data.error ?? "Error al guardar", "error");
    }
  }

  async function crearExcepcion() {
    if (!excFecha) {
      notificar("Elige una fecha", "error");
      return;
    }
    const res = await fetch("/api/excepciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha: excFecha,
        cerrado: excCerrado,
        hora_inicio: excCerrado ? null : excInicio,
        hora_fin: excCerrado ? null : excFin,
      }),
    });
    if (res.ok) {
      setExcFecha("");
      await cargarHorario();
      notificar("Excepción añadida");
    } else {
      const data = await res.json();
      notificar(data.error ?? "Error", "error");
    }
  }

  async function borrarExcepcion(id: string) {
    setExcepciones((prev) => prev.filter((e) => e.id !== id));
    await fetch("/api/excepciones", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    notificar("Excepción eliminada");
  }

  // --- Servicios ---
  async function crearServicio() {
    if (!nuevoNombre || !nuevoPrecio || !nuevaDuracion) {
      notificar("Rellena todos los campos", "error");
      return;
    }
    const res = await fetch("/api/servicios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: nuevoNombre,
        precio: Number(nuevoPrecio),
        duracion_min: Number(nuevaDuracion),
        orden: servicios.length,
      }),
    });
    if (res.ok) {
      setNuevoNombre("");
      setNuevoPrecio("");
      setNuevaDuracion("");
      await cargarServicios();
      notificar("Servicio creado");
    } else {
      const data = await res.json();
      notificar(data.error ?? "Error al crear", "error");
    }
  }

  async function eliminarServicio(id: string) {
    setServicios((prev) => prev.filter((s) => s.id !== id));
    await fetch("/api/servicios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    notificar("Servicio eliminado");
  }

  if (cargandoSesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <svg className="h-6 w-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const reservasFiltradas = reservas.filter((r) => r.estado === filtroEstado);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
          <span className="text-sm font-semibold tracking-tight">Panel de gestión</span>
          <button
            onClick={async () => {
              await signOut({ redirect: false });
              router.push("/");
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-soft transition hover:bg-secondary hover:text-foreground"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto max-w-2xl px-5 pt-5">
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1 shadow-soft">
          {(["reservas", "horario", "servicios"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                tab === t
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "reservas" ? "Reservas" : t === "horario" ? "Horario" : "Servicios"}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-6">
        {/* ===== RESERVAS ===== */}
        {tab === "reservas" && (
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Reservas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Gestiona las citas de tus clientes.</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {["confirmada", "cancelada", "completada"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroEstado(f)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    filtroEstado === f
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "confirmada" ? "Confirmadas" : f === "cancelada" ? "Canceladas" : "Completadas"}
                </button>
              ))}
            </div>

            {loadingReservas ? (
              <div className="flex justify-center py-12">
                <svg className="h-5 w-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : reservasFiltradas.length === 0 ? (
              <div className="mt-5 rounded-xl border border-border bg-card py-12 text-center shadow-soft">
                <p className="text-sm text-muted-foreground">No hay reservas en esta categoría.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {reservasFiltradas.map((r) => {
                  const { fecha, hora } = formatFechaHora(r.fecha_hora);
                  return (
                    <div key={r.id} className="rounded-xl border border-border bg-card px-5 py-4 shadow-soft">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{r.servicio?.nombre ?? "Servicio"}</span>
                        {r.servicio?.precio != null && (
                          <span className="font-semibold text-primary">{r.servicio.precio} €</span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="capitalize">{fecha}</span>
                        <span>·</span>
                        <span>{hora}</span>
                      </div>
                      {r.notas && (
                        <div className="mt-2.5 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                          {r.notas}
                        </div>
                      )}
                      {r.estado === "confirmada" && (
                        <button
                          onClick={() => cancelarReserva(r.id)}
                          className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive/15"
                        >
                          Cancelar cita
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== HORARIO ===== */}
        {tab === "horario" && (
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Horario de apertura</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Define tu horario para cada día de la semana. Se aplica a todas las semanas.
            </p>

            <div className="mt-6 space-y-3">
              {DIAS.map((dia, idx) => {
                const d = horarioDias[idx];
                return (
                  <div key={dia} className="rounded-xl border border-border bg-card p-4 shadow-soft">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-semibold">{dia}</span>
                      {!d.manana && !d.tarde && (
                        <span className="text-xs font-medium text-muted-foreground">Cerrado</span>
                      )}
                    </div>

                    {/* Turno mañana */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleTurno(idx, "manana")}
                        className={`w-20 shrink-0 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                          d.manana
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        Mañana
                      </button>
                      {d.manana && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={d.manana.inicio}
                            onChange={(e) => setFranja(idx, "manana", "inicio", e.target.value)}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          />
                          <span className="text-muted-foreground">–</span>
                          <input
                            type="time"
                            value={d.manana.fin}
                            onChange={(e) => setFranja(idx, "manana", "fin", e.target.value)}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          />
                        </div>
                      )}
                    </div>

                    {/* Turno tarde */}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => toggleTurno(idx, "tarde")}
                        className={`w-20 shrink-0 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                          d.tarde
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        Tarde
                      </button>
                      {d.tarde && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={d.tarde.inicio}
                            onChange={(e) => setFranja(idx, "tarde", "inicio", e.target.value)}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          />
                          <span className="text-muted-foreground">–</span>
                          <input
                            type="time"
                            value={d.tarde.fin}
                            onChange={(e) => setFranja(idx, "tarde", "fin", e.target.value)}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={guardarHorario}
              disabled={guardandoHorario}
              className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-50"
            >
              {guardandoHorario ? "Guardando..." : "Guardar horario"}
            </button>

            {/* Excepciones */}
            <div className="mt-10">
              <h3 className="text-lg font-semibold tracking-tight">Días especiales</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Marca un día concreto como cerrado o con un horario distinto (vacaciones, médico, festivos...).
              </p>

              <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-soft">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Fecha</span>
                  <input
                    type="date"
                    value={excFecha}
                    onChange={(e) => setExcFecha(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setExcCerrado(true)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
                      excCerrado
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    Cerrado
                  </button>
                  <button
                    onClick={() => setExcCerrado(false)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
                      !excCerrado
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    Horario especial
                  </button>
                </div>

                {!excCerrado && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <input
                      type="time"
                      value={excInicio}
                      onChange={(e) => setExcInicio(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <span className="text-muted-foreground">–</span>
                    <input
                      type="time"
                      value={excFin}
                      onChange={(e) => setExcFin(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                )}

                <button
                  onClick={crearExcepcion}
                  className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90"
                >
                  Añadir día especial
                </button>
              </div>

              {/* Lista de excepciones */}
              {excepciones.length > 0 && (
                <div className="mt-4 space-y-2">
                  {excepciones.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-soft"
                    >
                      <div>
                        <div className="text-sm font-medium capitalize">{formatFecha(e.fecha)}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.cerrado
                            ? "Cerrado"
                            : `Abierto ${e.hora_inicio?.substring(0, 5)} – ${e.hora_fin?.substring(0, 5)}`}
                        </div>
                      </div>
                      <button
                        onClick={() => borrarExcepcion(e.id)}
                        className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive/15"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== SERVICIOS ===== */}
        {tab === "servicios" && (
          <div>
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Servicios</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {servicios.length}/{LIMITE_SERVICIOS} servicios. Tu plan Básico permite hasta {LIMITE_SERVICIOS}.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {servicios.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 shadow-soft"
                >
                  <div>
                    <div className="font-semibold">{s.nombre}</div>
                    <div className="text-sm text-muted-foreground">
                      {s.duracion_min} min · {s.precio} €
                    </div>
                  </div>
                  <button
                    onClick={() => eliminarServicio(s.id)}
                    className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive/15"
                  >
                    Borrar
                  </button>
                </div>
              ))}
            </div>

            {/* Nuevo servicio (solo si no se ha alcanzado el límite) */}
            {servicios.length < LIMITE_SERVICIOS ? (
              <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-soft">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Nuevo servicio
                </p>
                <input
                  type="text"
                  placeholder="Nombre del servicio"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    placeholder="Precio €"
                    value={nuevoPrecio}
                    onChange={(e) => setNuevoPrecio(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Duración (min)"
                    value={nuevaDuracion}
                    onChange={(e) => setNuevaDuracion(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={crearServicio}
                  className="mt-3 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90"
                >
                  Añadir servicio
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-border bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
                Has alcanzado el límite de {LIMITE_SERVICIOS} servicios del plan Básico.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Toast */}
      {mensaje && (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2">
          <div
            className={`rounded-full px-5 py-2.5 text-sm font-medium shadow-card ${
              mensaje.tipo === "ok"
                ? "bg-primary text-primary-foreground"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {mensaje.texto}
          </div>
        </div>
      )}
    </div>
  );
}