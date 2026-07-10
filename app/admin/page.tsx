"use client";
import { useEffect, useState, useCallback, useRef } from "react";
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

// --- PRO: tipo de bloqueo (comentado en plan Básico) ---
// type Bloqueo = {
//   id: string;
//   fecha: string;
//   hora_inicio: string;
//   hora_fin: string;
//   motivo: string | null;
// };

type Franja = { dia_semana: number; hora_inicio: string; hora_fin: string };

// --- PRO: tipo de excepción / día especial (comentado en plan Básico) ---
// type Excepcion = {
//   id: string;
//   fecha: string;
//   cerrado: boolean;
//   hora_inicio: string | null;
//   hora_fin: string | null;
// };

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

// Día de la semana (0=lunes..6=domingo) a partir de "YYYY-MM-DD"
function diaSemanaDeFecha(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const js = new Date(y, m - 1, d).getDay(); // 0=domingo
  return (js + 6) % 7; // 0=lunes
}

function fechaLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fechaDeReserva(fechaHora: string): string {
  return fechaHora.split(" ")[0];
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

function generarSlots(inicioMin: number, finMin: number, duracion: number, intervalo: number): string[] {
  const slots: string[] = [];
  for (let min = inicioMin; min + duracion <= finMin; min += intervalo) {
    slots.push(aHora(min));
  }
  return slots;
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
  const [hoyISO, setHoyISO] = useState(() => fechaLocalISO(new Date()));
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(hoyISO);
  const tiraRef = useRef<HTMLDivElement>(null);
  // Mover cita
  const [moviendo, setMoviendo] = useState<Reserva | null>(null);
  const [moverFecha, setMoverFecha] = useState("");
  const [moverHoras, setMoverHoras] = useState<{ hora: string; ocupada: boolean }[]>([]);
  const [moverHora, setMoverHora] = useState<string | null>(null);
  const [cargandoMoverHoras, setCargandoMoverHoras] = useState(false);
  const [guardandoMover, setGuardandoMover] = useState(false);
  // Horario semanal: por cada día, franja mañana y tarde (opcionales)
  const [horarioDias, setHorarioDias] = useState<
    { manana: { inicio: string; fin: string } | null; tarde: { inicio: string; fin: string } | null }[]
  >(() => DIAS.map(() => ({ manana: null, tarde: null })));
  const [guardandoHorario, setGuardandoHorario] = useState(false);

  // --- PRO: intervalo de citas (comentado en plan Básico) ---
  const [intervalo, setIntervalo] = useState(30);
  // const [guardandoIntervalo, setGuardandoIntervalo] = useState(false);

  // --- PRO: excepciones / días especiales (comentado en plan Básico) ---
  // const [excepciones, setExcepciones] = useState<Excepcion[]>([]);
  // const [excFecha, setExcFecha] = useState("");
  // const [excCerrado, setExcCerrado] = useState(true);
  // const [excManana, setExcManana] = useState<{ inicio: string; fin: string } | null>(null);
  // const [excTarde, setExcTarde] = useState<{ inicio: string; fin: string } | null>(null);

  // --- PRO: bloqueos de horas sueltas (comentado en plan Básico) ---
  // const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  // const [bloqFecha, setBloqFecha] = useState("");
  // const [bloqInicio, setBloqInicio] = useState("07:00");
  // const [bloqFin, setBloqFin] = useState("08:00");
  // const [bloqMotivo, setBloqMotivo] = useState("");

  // Servicios
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [nuevaDuracion, setNuevaDuracion] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editPrecio, setEditPrecio] = useState("");
  const [editDuracion, setEditDuracion] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

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

  const [confirmacion, setConfirmacion] = useState<{
    texto: string;
    onConfirmar: () => void;
  } | null>(null);

  function pedirConfirmacion(texto: string, onConfirmar: () => void) {
    setConfirmacion({ texto, onConfirmar });
  }

  const cargarReservas = useCallback(async () => {
    setLoadingReservas(true);
    const res = await fetch("/api/reservas-admin");
    if (res.ok) setReservas(await res.json());
    setLoadingReservas(false);
  }, []);

  const cargarHorario = useCallback(async () => {
    if (!barberiaId) return;
    const resH = await fetch(`/api/horario-semanal?barberia_id=${barberiaId}`);
    const franjas: Franja[] = resH.ok ? await resH.json() : [];
    const dias = DIAS.map(() => ({
      manana: null as { inicio: string; fin: string } | null,
      tarde: null as { inicio: string; fin: string } | null,
    }));
    for (const f of franjas) {
      const ini = f.hora_inicio.substring(0, 5);
      const fin = f.hora_fin.substring(0, 5);
      if (!dias[f.dia_semana].manana) dias[f.dia_semana].manana = { inicio: ini, fin };
      else dias[f.dia_semana].tarde = { inicio: ini, fin };
    }
    setHorarioDias(dias);

    // --- PRO: cargar excepciones (comentado en plan Básico) ---
    // const resE = await fetch(`/api/excepciones?barberia_id=${barberiaId}`);
    // if (resE.ok) setExcepciones(await resE.json());

    // --- PRO: cargar bloqueos (comentado en plan Básico) ---
    // const resB = await fetch(`/api/bloqueos?barberia_id=${barberiaId}`);
    // if (resB.ok) setBloqueos(await resB.json());

    // Intervalo: se sigue leyendo para que el "Mover cita" genere los huecos
    // con el paso correcto. En Básico no se puede cambiar (fijo en 30), pero
    // se lee por si el valor guardado fuera otro.
    const resI = await fetch(`/api/intervalo?barberia_id=${barberiaId}`);
    if (resI.ok) {
      const data = await resI.json();
      setIntervalo(data.intervalo_min ?? 30);
    }
  }, [barberiaId]);

  const cargarServicios = useCallback(async () => {
    if (!barberiaId) return;
    const res = await fetch(`/api/servicios?barberia_id=${barberiaId}`);
    if (res.ok) setServicios(await res.json());
  }, [barberiaId]);

  useEffect(() => {
    if (!barberiaId) return;
    if (tab === "reservas") {
      const nuevoHoy = fechaLocalISO(new Date());
      setHoyISO(nuevoHoy);
      setDiaSeleccionado(nuevoHoy);
      cargarReservas();
    }
    if (tab === "horario") cargarHorario();
    if (tab === "servicios") cargarServicios();
  }, [tab, barberiaId, cargarReservas, cargarHorario, cargarServicios]);

  useEffect(() => {
    const activo = tiraRef.current?.querySelector<HTMLElement>("[data-activo='true']");
    activo?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [filtroEstado, reservas.length, diaSeleccionado, hoyISO]);

  function cancelarReserva(id: string) {
    pedirConfirmacion("¿Cancelar esta cita? Se notificará como cancelada.", async () => {
      setReservas((prev) => prev.map((r) => (r.id === id ? { ...r, estado: "cancelada" } : r)));
      const res = await fetch("/api/cancelar-reserva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) notificar("Reserva cancelada");
      else notificar("No se pudo cancelar", "error");
    });
  }

  // Abre el modal de mover: carga horario si hace falta
  async function abrirMover(reserva: Reserva) {
    setMoviendo(reserva);
    setMoverFecha("");
    setMoverHoras([]);
    setMoverHora(null);
    // Aseguramos tener horario e intervalo cargados
    await cargarHorario();
  }

  // Franjas [inicioMin, finMin] de una fecha "YYYY-MM-DD" (solo horario semanal en Básico)
  function franjasDeFechaAdmin(fecha: string): [number, number][] {
    // --- PRO: excepciones tendrían prioridad aquí (comentado en Básico) ---
    // const excDia = excepciones.filter((e) => e.fecha === fecha);
    // if (excDia.length > 0) {
    //   if (excDia.some((e) => e.cerrado)) return [];
    //   return excDia
    //     .filter((e) => e.hora_inicio && e.hora_fin)
    //     .map((e) => [aMinutos(e.hora_inicio as string), aMinutos(e.hora_fin as string)] as [number, number]);
    // }
    const ds = diaSemanaDeFecha(fecha);
    // horarioDias está en formato {manana, tarde}; lo convertimos a franjas
    const d = horarioDias[ds];
    const franjas: [number, number][] = [];
    if (d?.manana) franjas.push([aMinutos(d.manana.inicio), aMinutos(d.manana.fin)]);
    if (d?.tarde) franjas.push([aMinutos(d.tarde.inicio), aMinutos(d.tarde.fin)]);
    return franjas;
  }

  // Calcula huecos libres del día destino para la cita que se está moviendo
  async function cargarMoverHoras(fecha: string) {
    if (!moviendo || !barberiaId) return;
    setMoverFecha(fecha);
    setMoverHora(null);
    setMoverHoras([]);
    if (!fecha) return;

    setCargandoMoverHoras(true);
    const duracion = moviendo.servicio?.duracion_min ?? 30;

    const franjas = franjasDeFechaAdmin(fecha);
    if (franjas.length === 0) {
      setMoverHoras([]);
      setCargandoMoverHoras(false);
      return;
    }

    let slots: string[] = [];
    for (const [ini, fin] of franjas) {
      slots = [...slots, ...generarSlots(ini, fin, duracion, intervalo)];
    }

    // Reservas de ese día para marcar ocupadas
    const resReservas = await fetch(`/api/reservas-dia?barberia_id=${barberiaId}&fecha=${fecha}`);
    const reservasDia: { fecha_hora: string; duracion_min: number }[] = resReservas.ok
      ? await resReservas.json()
      : [];

    // --- PRO: bloqueos de ese día (comentado en Básico) ---
    // const bloqueosDia = bloqueos.filter((b) => b.fecha === fecha);
    const horaActual = moviendo.fecha_hora.substring(11, 16); // para no marcar su propio hueco

    const ocupado = (slot: string) => {
      const slotMin = aMinutos(slot);
      const slotFinMin = slotMin + duracion;
      for (const r of reservasDia) {
        // No contar la propia cita si sigue en su sitio original
        if (fechaDeReserva(moviendo.fecha_hora) === fecha && r.fecha_hora.substring(11, 16) === horaActual) continue;
        const rMin = aMinutos(r.fecha_hora.substring(11, 16));
        const rFinMin = rMin + (r.duracion_min ?? 30);
        if (slotMin < rFinMin && slotFinMin > rMin) return true;
      }
      // --- PRO: comprobar solape con bloqueos (comentado en Básico) ---
      // for (const b of bloqueosDia) {
      //   const bMin = aMinutos(b.hora_inicio);
      //   const bFinMin = aMinutos(b.hora_fin);
      //   if (slotMin < bFinMin && slotFinMin > bMin) return true;
      // }
      return false;
    };

    const ahora = new Date();
    const esHoy = fechaLocalISO(ahora) === fecha;
    const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();

    setMoverHoras(
      slots
        .filter((h) => !(esHoy && aMinutos(h) <= ahoraMin))
        .map((h) => ({ hora: h, ocupada: ocupado(h) })),
    );
    setCargandoMoverHoras(false);
  }

  async function confirmarMover() {
    if (!moviendo || !moverFecha || !moverHora) return;
    setGuardandoMover(true);
    const res = await fetch("/api/mover-reserva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: moviendo.id, fecha_hora: `${moverFecha} ${moverHora}` }),
    });
    setGuardandoMover(false);
    if (res.ok) {
      setMoviendo(null);
      await cargarReservas();
      notificar("Cita movida");
    } else {
      const data = await res.json().catch(() => null);
      notificar(data?.error ?? "No se pudo mover", "error");
    }
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

  // --- PRO: guardar intervalo (comentado en plan Básico) ---
  // async function guardarIntervalo(nuevo: number) {
  //   setIntervalo(nuevo);
  //   setGuardandoIntervalo(true);
  //   const res = await fetch("/api/intervalo", {
  //     method: "PUT",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ intervalo_min: nuevo }),
  //   });
  //   setGuardandoIntervalo(false);
  //   if (res.ok) notificar("Intervalo guardado");
  //   else notificar("Error al guardar el intervalo", "error");
  // }

  // --- PRO: crear/borrar bloqueos de horas sueltas (comentado en plan Básico) ---
  // async function crearBloqueo() {
  //   if (!bloqFecha || !bloqInicio || !bloqFin) {
  //     notificar("Rellena fecha y horas", "error");
  //     return;
  //   }
  //   if (bloqInicio >= bloqFin) {
  //     notificar("La hora de fin debe ser posterior", "error");
  //     return;
  //   }
  //   const res = await fetch("/api/bloqueos", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({
  //       fecha: bloqFecha,
  //       hora_inicio: bloqInicio,
  //       hora_fin: bloqFin,
  //       motivo: bloqMotivo,
  //     }),
  //   });
  //   if (res.ok) {
  //     setBloqFecha("");
  //     setBloqMotivo("");
  //     await cargarHorario();
  //     notificar("Bloqueo guardado");
  //   } else {
  //     const data = await res.json();
  //     notificar(data.error ?? "Error al guardar", "error");
  //   }
  // }

  // function borrarBloqueo(id: string) {
  //   pedirConfirmacion("¿Quitar este bloqueo?", async () => {
  //     setBloqueos((prev) => prev.filter((b) => b.id !== id));
  //     await fetch("/api/bloqueos", {
  //       method: "DELETE",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ id }),
  //     });
  //     notificar("Bloqueo eliminado");
  //   });
  // }

  // --- PRO: días especiales / excepciones (comentado en plan Básico) ---
  // function onCambiarFechaExcepcion(fecha: string) {
  //   setExcFecha(fecha);
  //   if (!fecha) {
  //     setExcManana(null);
  //     setExcTarde(null);
  //     return;
  //   }
  //   const dia = diaSemanaDeFecha(fecha);
  //   setExcManana(horarioDias[dia].manana ? { ...horarioDias[dia].manana! } : null);
  //   setExcTarde(horarioDias[dia].tarde ? { ...horarioDias[dia].tarde! } : null);
  // }

  // function toggleExcTurno(turno: "manana" | "tarde") {
  //   if (turno === "manana") {
  //     setExcManana((prev) => (prev ? null : { inicio: "09:30", fin: "13:45" }));
  //   } else {
  //     setExcTarde((prev) => (prev ? null : { inicio: "16:00", fin: "20:00" }));
  //   }
  // }

  // function setExcFranja(turno: "manana" | "tarde", campo: "inicio" | "fin", valor: string) {
  //   if (turno === "manana") {
  //     setExcManana((prev) => ({ ...(prev ?? { inicio: "", fin: "" }), [campo]: valor }));
  //   } else {
  //     setExcTarde((prev) => ({ ...(prev ?? { inicio: "", fin: "" }), [campo]: valor }));
  //   }
  // }

  // async function crearExcepcion() {
  //   if (!excFecha) {
  //     notificar("Elige una fecha", "error");
  //     return;
  //   }
  //   const franjas: { inicio: string; fin: string }[] = [];
  //   if (!excCerrado) {
  //     if (excManana) franjas.push(excManana);
  //     if (excTarde) franjas.push(excTarde);
  //     if (franjas.length === 0) {
  //       notificar("Activa al menos un turno o marca el día como cerrado", "error");
  //       return;
  //     }
  //   }
  //   const res = await fetch("/api/excepciones", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ fecha: excFecha, cerrado: excCerrado, franjas }),
  //   });
  //   if (res.ok) {
  //     setExcFecha("");
  //     setExcManana(null);
  //     setExcTarde(null);
  //     setExcCerrado(true);
  //     await cargarHorario();
  //     notificar("Día especial guardado");
  //   } else {
  //     const data = await res.json();
  //     notificar(data.error ?? "Error", "error");
  //   }
  // }

  // function borrarExcepcion(fecha: string) {
  //   pedirConfirmacion(`¿Quitar el día especial del ${formatFecha(fecha)}?`, async () => {
  //     setExcepciones((prev) => prev.filter((e) => e.fecha !== fecha));
  //     await fetch("/api/excepciones", {
  //       method: "DELETE",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ fecha }),
  //     });
  //     notificar("Día especial eliminado");
  //   });
  // }

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

  function empezarEdicion(s: Servicio) {
    setEditandoId(s.id);
    setEditNombre(s.nombre);
    setEditPrecio(String(s.precio));
    setEditDuracion(String(s.duracion_min));
  }

  function cancelarEdicion() {
    setEditandoId(null);
  }

  async function guardarEdicion(id: string) {
    if (!editNombre || !editPrecio || !editDuracion) {
      notificar("Rellena todos los campos", "error");
      return;
    }
    setGuardandoEdicion(true);
    const res = await fetch("/api/servicios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        nombre: editNombre,
        precio: Number(editPrecio),
        duracion_min: Number(editDuracion),
      }),
    });
    setGuardandoEdicion(false);
    if (res.ok) {
      setEditandoId(null);
      await cargarServicios();
      notificar("Servicio actualizado");
    } else {
      const data = await res.json().catch(() => null);
      notificar(data?.error ?? "Error al actualizar", "error");
    }
  }

  function eliminarServicio(id: string, nombre: string) {
    pedirConfirmacion(`¿Borrar el servicio "${nombre}"? Esta acción no se puede deshacer.`, async () => {
      setServicios((prev) => prev.filter((s) => s.id !== id));
      await fetch("/api/servicios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      notificar("Servicio eliminado");
    });
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

  const reservasPorEstado = reservas.filter((r) => r.estado === filtroEstado);

  const DIAS_ATRAS = 7;
  const DIAS_ADELANTE = 30;
  const hoy = new Date();
  const dias: string[] = [];
  for (let i = -DIAS_ATRAS; i <= DIAS_ADELANTE; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    dias.push(fechaLocalISO(d));
  }

  const reservasFiltradas = reservasPorEstado
    .filter((r) => fechaDeReserva(r.fecha_hora) === diaSeleccionado)
    .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));

  // --- PRO: agrupar excepciones por fecha (comentado en plan Básico) ---
  // const excepcionesPorFecha = excepciones
  //   .filter((e) => e.fecha >= hoyISO)
  //   .reduce<Record<string, Excepcion[]>>((acc, e) => {
  //     (acc[e.fecha] ??= []).push(e);
  //     return acc;
  //   }, {});

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-primary/15 bg-primary/[0.07] backdrop-blur">
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
                  onClick={() => {
                    setFiltroEstado(f);
                    setDiaSeleccionado(hoyISO);
                  }}
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

            {/* Scroll de días */}
            <div className="-mx-5 mt-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div ref={tiraRef} className="flex gap-2">
                {dias.map((f) => {
                  const [y, m, d] = f.split("-");
                  const obj = new Date(Number(y), Number(m) - 1, Number(d));
                  const esHoy = f === hoyISO;
                  const activo = f === diaSeleccionado;
                  const num = reservasPorEstado.filter(
                    (r) => fechaDeReserva(r.fecha_hora) === f
                  ).length;
                  return (
                    <button
                      key={f}
                      data-activo={activo}
                      onClick={() => setDiaSeleccionado(f)}
                      className={`flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2 transition ${
                        activo
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        {esHoy ? "Hoy" : obj.toLocaleDateString("es-ES", { weekday: "short" })}
                      </span>
                      <span className="text-lg font-semibold leading-tight">{obj.getDate()}</span>
                      <span className="text-[10px] capitalize">
                        {obj.toLocaleDateString("es-ES", { month: "short" })}
                      </span>
                      {num > 0 && (
                        <span
                          className={`mt-0.5 rounded-full px-1.5 text-[10px] font-semibold ${
                            activo ? "bg-primary/20" : "bg-primary/10 text-primary"
                          }`}
                        >
                          {num}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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
                <p className="text-sm text-muted-foreground">No hay reservas este día.</p>
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
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => abrirMover(r)}
                            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-soft transition hover:bg-secondary"
                          >
                            Mover cita
                          </button>
                          <button
                            onClick={() => cancelarReserva(r.id)}
                            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive/15"
                          >
                            Cancelar cita
                          </button>
                        </div>
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

            {/* ============================================================= */}
            {/* PRO: Días especiales, Intervalo entre citas y Bloqueos.       */}
            {/* Comentado en el plan Básico. Para reactivar en la Pro,        */}
            {/* descomenta este bloque y también los estados/funciones de     */}
            {/* arriba marcados con "PRO:".                                   */}
            {/* ============================================================= */}
            {/*
            <div className="mt-10">
              <h3 className="text-lg font-semibold tracking-tight">Días especiales</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cierra un día o ponle un horario distinto. Al elegir la fecha se carga tu horario habitual de ese día para que solo lo ajustes.
              </p>

              <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-soft">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Fecha</span>
                  <input
                    type="date"
                    value={excFecha}
                    onChange={(e) => onCambiarFechaExcepcion(e.target.value)}
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
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExcTurno("manana")}
                        className={`w-20 shrink-0 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                          excManana
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        Mañana
                      </button>
                      {excManana && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={excManana.inicio}
                            onChange={(e) => setExcFranja("manana", "inicio", e.target.value)}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          />
                          <span className="text-muted-foreground">–</span>
                          <input
                            type="time"
                            value={excManana.fin}
                            onChange={(e) => setExcFranja("manana", "fin", e.target.value)}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExcTurno("tarde")}
                        className={`w-20 shrink-0 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                          excTarde
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        Tarde
                      </button>
                      {excTarde && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={excTarde.inicio}
                            onChange={(e) => setExcFranja("tarde", "inicio", e.target.value)}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          />
                          <span className="text-muted-foreground">–</span>
                          <input
                            type="time"
                            value={excTarde.fin}
                            onChange={(e) => setExcFranja("tarde", "fin", e.target.value)}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={crearExcepcion}
                  className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90"
                >
                  Guardar día especial
                </button>
              </div>

              {Object.keys(excepcionesPorFecha).length > 0 && (
                <div className="mt-4 space-y-2">
                  {Object.entries(excepcionesPorFecha).map(([fecha, items]) => {
                    const cerrado = items.some((i) => i.cerrado);
                    return (
                      <div
                        key={fecha}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-soft"
                      >
                        <div>
                          <div className="text-sm font-medium capitalize">{formatFecha(fecha)}</div>
                          <div className="text-xs text-muted-foreground">
                            {cerrado
                              ? "Cerrado"
                              : items
                                  .map((i) => `${i.hora_inicio?.substring(0, 5)}–${i.hora_fin?.substring(0, 5)}`)
                                  .join("  ·  ")}
                          </div>
                        </div>
                        <button
                          onClick={() => borrarExcepcion(fecha)}
                          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive/15"
                        >
                          Quitar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-semibold tracking-tight">Intervalo entre citas</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada cuánto se ofrecen huecos a tus clientes al reservar.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[10, 15, 20, 30, 45, 60].map((min) => (
                  <button
                    key={min}
                    onClick={() => guardarIntervalo(min)}
                    disabled={guardandoIntervalo}
                    className={`rounded-md border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                      intervalo === min
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {min} min
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-semibold tracking-tight">Bloquear horas sueltas</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Bloquea una franja concreta de un día (por ejemplo, una cita médica) sin cerrar todo el día.
              </p>

              <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-soft">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Fecha</span>
                  <input
                    type="date"
                    value={bloqFecha}
                    onChange={(e) => setBloqFecha(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>

                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1">
                    <span className="mb-1.5 block text-sm font-medium">Desde</span>
                    <input
                      type="time"
                      value={bloqInicio}
                      onChange={(e) => setBloqInicio(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="mb-1.5 block text-sm font-medium">Hasta</span>
                    <input
                      type="time"
                      value={bloqFin}
                      onChange={(e) => setBloqFin(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>

                <label className="mt-3 block">
                  <span className="mb-1.5 block text-sm font-medium">Motivo (opcional)</span>
                  <input
                    type="text"
                    placeholder="Ej. Médico"
                    value={bloqMotivo}
                    onChange={(e) => setBloqMotivo(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>

                <button
                  onClick={crearBloqueo}
                  className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90"
                >
                  Bloquear franja
                </button>
              </div>

              {bloqueos.filter((b) => b.fecha >= hoyISO).length > 0 && (
                <div className="mt-4 space-y-2">
                  {bloqueos.filter((b) => b.fecha >= hoyISO).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-soft"
                    >
                      <div>
                        <div className="text-sm font-medium capitalize">{formatFecha(b.fecha)}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.hora_inicio.substring(0, 5)}–{b.hora_fin.substring(0, 5)}
                          {b.motivo ? `  ·  ${b.motivo}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => borrarBloqueo(b.id)}
                        className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive/15"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            */}
            {/* ============ FIN bloque PRO ============ */}
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
              {servicios.map((s) =>
                editandoId === s.id ? (
                  <div
                    key={s.id}
                    className="rounded-xl border border-primary/40 bg-card px-4 py-3.5 shadow-soft"
                  >
                    <input
                      type="text"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      placeholder="Nombre del servicio"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="mt-2 flex gap-2">
                      <input
                        type="number"
                        value={editPrecio}
                        onChange={(e) => setEditPrecio(e.target.value)}
                        placeholder="Precio €"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        value={editDuracion}
                        onChange={(e) => setEditDuracion(e.target.value)}
                        placeholder="Duración (min)"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={cancelarEdicion}
                        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => guardarEdicion(s.id)}
                        disabled={guardandoEdicion}
                        className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-50"
                      >
                        {guardandoEdicion ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                ) : (
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => empezarEdicion(s)}
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-soft transition hover:bg-secondary"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarServicio(s.id, s.nombre)}
                        className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition hover:bg-destructive/15"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>

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

      {/* Modal de mover cita */}
      {moviendo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 backdrop-blur-sm px-5">
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-card">
            <h3 className="text-base font-semibold">Mover cita</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {moviendo.servicio?.nombre ?? "Servicio"} · actualmente {formatFechaHora(moviendo.fecha_hora).fecha} a las {formatFechaHora(moviendo.fecha_hora).hora}
            </p>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium">Nuevo día</span>
              <input
                type="date"
                value={moverFecha}
                min={hoyISO}
                onChange={(e) => cargarMoverHoras(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>

            {moverFecha && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Nueva hora
                </p>
                {cargandoMoverHoras ? (
                  <div className="flex justify-center py-6">
                    <svg className="h-5 w-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : moverHoras.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No hay horas disponibles ese día.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {moverHoras.map(({ hora, ocupada }) => (
                      <button
                        key={hora}
                        disabled={ocupada}
                        onClick={() => setMoverHora(hora)}
                        className={`rounded-lg border py-2 text-sm font-medium transition ${
                          ocupada
                            ? "cursor-not-allowed border-border bg-muted text-muted-foreground/40"
                            : moverHora === hora
                              ? "border-primary bg-accent text-accent-foreground"
                              : "border-border bg-background text-foreground hover:border-ring/40"
                        }`}
                      >
                        {hora}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setMoviendo(null)}
                className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarMover}
                disabled={!moverHora || guardandoMover}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-50"
              >
                {guardandoMover ? "Moviendo..." : "Mover aquí"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {confirmacion && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 backdrop-blur-sm px-5">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-sm font-medium text-foreground">{confirmacion.texto}</p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmacion(null)}
                className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  confirmacion.onConfirmar();
                  setConfirmacion(null);
                }}
                className="flex-1 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-soft transition hover:opacity-90"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}