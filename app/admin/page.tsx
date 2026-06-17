"use client";
import { useEffect, useState } from "react";
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

function fechaStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatFechaHora(str: string) {
  const [fecha, hora] = str.split(" ");
  const [y, m, d] = fecha.split("-");
  const fechaObj = new Date(Number(y), Number(m) - 1, Number(d));
  return {
    fecha: fechaObj.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }),
    hora: hora ?? "",
  };
}

const ESTADO_COLORS: Record<string, string> = {
  confirmada: "text-green-400 bg-green-500/10 border-green-500/20",
  cancelada: "text-red-400 bg-red-500/10 border-red-500/20",
  completada: "text-zinc-400 bg-white/5 border-white/10",
};

export default function AdminPage() {
  const router = useRouter();
  const [barberiaId, setBarberiaId] = useState<string | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [tab, setTab] = useState<"reservas" | "agenda" | "servicios">("reservas");
  const [mensajeExito, setMensajeExito] = useState("");

  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("confirmada");

  const [agenda, setAgenda] = useState<Record<string, string[]>>({});
  const [diasSemana] = useState(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]);

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [nuevaDuracion, setNuevaDuracion] = useState("");

  function mostrarExito(texto: string) {
    setMensajeExito(texto);
    setTimeout(() => setMensajeExito(""), 3000);
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

  async function cargarReservas() {
    if (!barberiaId) return;
    setLoadingReservas(true);
    const res = await fetch(`/api/reservas-admin?barberia_id=${barberiaId}`);
    if (res.ok) {
      const data = await res.json();
      setReservas(data);
    }
    setLoadingReservas(false);
  }

  async function cargarAgenda() {
    if (!barberiaId) return;
    const res = await fetch(`/api/agenda?barberia_id=${barberiaId}`);
    const data: { fecha: string; turno: string }[] = await res.json();
    const mapa: Record<string, string[]> = {};
    data.forEach((item) => {
      if (!mapa[item.fecha]) mapa[item.fecha] = [];
      mapa[item.fecha].push(item.turno);
    });
    setAgenda(mapa);
  }

  async function cargarServicios() {
    if (!barberiaId) return;
    const res = await fetch(`/api/servicios?barberia_id=${barberiaId}`);
    if (res.ok) setServicios(await res.json());
  }

  useEffect(() => {
    if (!barberiaId) return;
    if (tab === "reservas") cargarReservas();
    if (tab === "agenda") cargarAgenda();
    if (tab === "servicios") cargarServicios();
  }, [tab, barberiaId]);

  async function cancelarReserva(id: string) {
    setReservas((prev) => prev.filter((r) => r.id !== id));
    fetch("/api/cancelar-reserva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mostrarExito("Reserva cancelada");
  }

  async function toggleTurnoHoy(dia: number, turno: string) {
    // dia: 0 = lunes ... 6 = domingo, lo aplicamos a los próximos ejemplares de ese día
    if (!barberiaId) return;
    const hoy = new Date();
    const fechasObjetivo: string[] = [];
    for (let i = 0; i < 56; i++) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() + i);
      const diaSemana = (d.getDay() + 6) % 7; // 0 = lunes
      if (diaSemana === dia) fechasObjetivo.push(fechaStr(d));
    }

    const activo = (agenda[fechasObjetivo[0]] ?? []).includes(turno);

    for (const fecha of fechasObjetivo) {
      if (activo) {
        await fetch("/api/agenda", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barberia_id: barberiaId, fecha, turno }),
        });
      } else {
        await fetch("/api/agenda", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barberia_id: barberiaId, fecha, turno }),
        });
      }
    }
    await cargarAgenda();
    mostrarExito("Horario actualizado");
  }

  async function crearServicio() {
    if (!barberiaId || !nuevoNombre || !nuevoPrecio || !nuevaDuracion) return;
    await fetch("/api/servicios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberia_id: barberiaId,
        nombre: nuevoNombre,
        precio: Number(nuevoPrecio),
        duracion_min: Number(nuevaDuracion),
        activo: true,
        orden: servicios.length,
      }),
    });
    setNuevoNombre("");
    setNuevoPrecio("");
    setNuevaDuracion("");
    await cargarServicios();
    mostrarExito("Servicio creado");
  }

  async function eliminarServicio(id: string) {
    setServicios((prev) => prev.filter((s) => s.id !== id));
    await fetch("/api/servicios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mostrarExito("Servicio eliminado");
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

  const reservasFiltradas = reservas.filter((r) => r.estado === filtroEstado);

  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <span className="font-bold text-white text-sm">Panel admin</span>
        <button
          onClick={async () => {
            await signOut({ redirect: false });
            router.push("/");
          }}
          className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full font-semibold"
        >
          Cerrar sesión
        </button>
      </nav>

      <div className="flex gap-1 px-6 pt-5 pb-1 max-w-lg mx-auto">
        {(["reservas", "agenda", "servicios"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold ${
              tab === t ? "bg-purple-500/15 border border-purple-500/40 text-purple-300" : "bg-white/[0.03] border border-white/[0.07] text-zinc-500"
            }`}
          >
            {t === "reservas" ? "📋 Reservas" : t === "agenda" ? "☀ Horario" : "✂ Servicios"}
          </button>
        ))}
      </div>

      <main className="px-6 pb-20 max-w-lg mx-auto pt-4">
        {tab === "reservas" && (
          <div>
            <h2 className="text-white text-2xl font-bold mb-1">Reservas</h2>
            <p className="text-zinc-500 text-sm mb-5">Gestiona las citas de tus clientes</p>

            <div className="flex gap-2 mb-5 flex-wrap">
              {["confirmada", "cancelada", "completada"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroEstado(f)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border ${
                    filtroEstado === f ? "bg-purple-500/15 border-purple-500/40 text-purple-300" : "bg-white/[0.03] border-white/[0.07] text-zinc-500"
                  }`}
                >
                  {f === "confirmada" ? "Confirmadas" : f === "cancelada" ? "Canceladas" : "Completadas"}
                </button>
              ))}
            </div>

            {loadingReservas ? (
              <div className="flex justify-center py-12">
                <svg className="animate-spin h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : reservasFiltradas.length === 0 ? (
              <div className="text-center py-12 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                <p className="text-zinc-500 text-sm">No hay reservas &quot;{filtroEstado}&quot;</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reservasFiltradas.map((r) => {
                  const { fecha, hora } = formatFechaHora(r.fecha_hora);
                  return (
                    <div key={r.id} className="bg-white/[0.025] border border-white/[0.07] rounded-[16px] px-5 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white text-base font-bold">{r.servicio?.nombre ?? "Servicio"}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ESTADO_COLORS[r.estado] ?? ""}`}>
                          {r.estado}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[14px] text-zinc-300 mb-2">
                        <span>{fecha}</span>
                        <span className="font-medium">🕐 {hora}</span>
                        {r.servicio?.precio && <span className="text-purple-400 font-bold">{r.servicio.precio}€</span>}
                      </div>
                      {r.notas && (
                        <div className="text-[13px] text-zinc-300 bg-white/[0.04] border border-white/[0.05] rounded-lg px-3 py-2 mb-2">
                          {r.notas}
                        </div>
                      )}
                      {r.estado === "confirmada" && (
                        <button
                          onClick={() => cancelarReserva(r.id)}
                          className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-[10px] font-semibold"
                        >
                          ✕ Cancelar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "agenda" && (
          <div>
            <h2 className="text-white text-2xl font-bold mb-1">Horario semanal</h2>
            <p className="text-zinc-500 text-sm mb-5">Activa los turnos para cada día de la semana</p>
            <div className="space-y-3">
              {diasSemana.map((dia, idx) => {
                const hoy = new Date();
                const proximaFecha = (() => {
                  for (let i = 0; i < 7; i++) {
                    const d = new Date(hoy);
                    d.setDate(hoy.getDate() + i);
                    if ((d.getDay() + 6) % 7 === idx) return fechaStr(d);
                  }
                  return fechaStr(hoy);
                })();
                const turnosActivos = agenda[proximaFecha] ?? [];
                return (
                  <div key={dia} className="bg-white/[0.025] border border-white/[0.07] rounded-[16px] px-4 py-3">
                    <p className="text-white text-sm font-semibold mb-2">{dia}</p>
                    <div className="flex gap-2">
                      {["manana", "tarde", "cerrado"].map((turno) => {
                        const activo = turnosActivos.includes(turno);
                        return (
                          <button
                            key={turno}
                            onClick={() => toggleTurnoHoy(idx, turno)}
                            className={`flex-1 py-2 rounded-[10px] border text-[12px] font-semibold ${
                              activo
                                ? turno === "cerrado"
                                  ? "bg-red-500/20 border-red-500/50 text-red-300"
                                  : "bg-purple-500/20 border-purple-500/50 text-purple-300"
                                : "bg-white/[0.02] border-white/[0.06] text-zinc-600"
                            }`}
                          >
                            {turno === "manana" ? "Mañana" : turno === "tarde" ? "Tarde" : "Cerrado"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-zinc-600 text-[11px] mt-4">
              El horario se aplica a las próximas 8 semanas automáticamente.
            </p>
          </div>
        )}

        {tab === "servicios" && (
          <div>
            <h2 className="text-white text-2xl font-bold mb-1">Servicios</h2>
            <p className="text-zinc-500 text-sm mb-5">Gestiona lo que ofreces a tus clientes</p>

            <div className="space-y-2 mb-6">
              {servicios.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-white/[0.025] border border-white/[0.07] rounded-[14px] px-4 py-3">
                  <div>
                    <div className="text-white text-sm font-semibold">{s.nombre}</div>
                    <div className="text-zinc-500 text-[12px]">{s.duracion_min} min</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-purple-400 font-bold">{s.precio}€</span>
                    <button onClick={() => eliminarServicio(s.id)} className="text-red-400 text-sm">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white/[0.025] border border-white/[0.07] rounded-[16px] p-4 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Nuevo servicio
              </p>
              <input
                type="text"
                placeholder="Nombre"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-sm text-zinc-100"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Precio €"
                  value={nuevoPrecio}
                  onChange={(e) => setNuevoPrecio(e.target.value)}
                  className="flex-1 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-sm text-zinc-100"
                />
                <input
                  type="number"
                  placeholder="Duración (min)"
                  value={nuevaDuracion}
                  onChange={(e) => setNuevaDuracion(e.target.value)}
                  className="flex-1 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-sm text-zinc-100"
                />
              </div>
              <button
                onClick={crearServicio}
                className="w-full bg-gradient-to-br from-purple-400 to-purple-600 text-zinc-950 font-bold py-3 rounded-[12px] text-sm"
              >
                Añadir servicio
              </button>
            </div>
          </div>
        )}
      </main>

      {mensajeExito && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100]">
          <div className="bg-green-500/15 border border-green-500/40 text-green-300 px-5 py-3 rounded-full text-sm font-semibold">
            ✓ {mensajeExito}
          </div>
        </div>
      )}
    </div>
  );
}
