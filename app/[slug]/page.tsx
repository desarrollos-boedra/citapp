"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import Image from "next/image";

type Barberia = {
  id: string;
  nombre: string;
  slug: string;
  telefono: string | null;
};

type Servicio = {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion_min: number;
  precio: number;
  icono: string | null;
};

type Usuario = {
  nombre: string;
  email: string;
  id: string;
};

type FranjaHorario = { dia_semana: number; hora_inicio: string; hora_fin: string };

export default function HomeBarberia() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const [horarioSemanal, setHorarioSemanal] = useState<FranjaHorario[]>([]);
  const [barberia, setBarberia] = useState<Barberia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navegando, setNavegando] = useState(false);
  const [pestana, setPestana] = useState<"inicio" | "reservas">("inicio");

useEffect(() => {
  async function cargar() {
    const res = await fetch(`/api/barberia/${slug}`);
    if (!res.ok) {
      setNoEncontrada(true);
      setCargando(false);
      return;
    }
    const data: Barberia = await res.json();
    setBarberia(data);

    const resServicios = await fetch(`/api/servicios?barberia_id=${data.id}`);
    if (resServicios.ok) {
      const svcs = await resServicios.json();
      setServicios(svcs);
    }

    const resHorario = await fetch(`/api/horario-semanal?barberia_id=${data.id}`);
    if (resHorario.ok) {
      const horario = await resHorario.json();
      setHorarioSemanal(horario);
    }

    setCargando(false);
  }
  cargar();
}, [slug]);

  useEffect(() => {
    async function cargarSesion() {
      const res = await fetch("/api/auth/session");
      const session = await res.json();
      if (session?.user) {
        setUsuario({
          nombre: session.user.name ?? "",
          email: session.user.email ?? "",
          id: session.user.id,
        });
      }
    }
    cargarSesion();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <svg className="h-6 w-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  function horarioPorDia() {
    return DIAS.map((nombreDia, idx) => {
      const franjas = horarioSemanal
        .filter((f) => f.dia_semana === idx)
        .map((f) => `${f.hora_inicio.substring(0, 5)}–${f.hora_fin.substring(0, 5)}`);
      return { dia: nombreDia, franjas };
    });
  }

  if (noEncontrada || !barberia) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">Negocio no encontrado</h1>
          <p className="mt-1 text-sm text-muted-foreground">Revisa que la dirección sea correcta.</p>
        </div>
      </div>
    );
  }

  const inicial = barberia.nombre.trim().charAt(0).toUpperCase();

return (
  <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className={`sticky top-0 z-40 border-b transition-all duration-300 ${
          scrolled
            ? "border-primary/15 bg-primary/[0.07] backdrop-blur-md shadow-[var(--shadow-soft)]"
            : "border-primary/10 bg-primary/[0.045] backdrop-blur"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
           <Image
            src="/boedra-logo.png"
            alt="Boedra"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 -translate-y-px object-contain"
          />
            <span className="font-serif text-[16px] font-semibold tracking-tight">{barberia.nombre}</span>
          </div>

          {usuario ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Hola, <span className="font-medium text-foreground">{usuario.nombre.split(" ")[0]}</span>
              </span>
              <button
                onClick={async () => {
                  await signOut({ redirect: false });
                  setUsuario(null);
                }}
                className="rounded-md border border-border bg-transparent px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-secondary hover:text-foreground"
              >
                Salir
              </button>
            </div>
          ) : (
           <div className="flex items-center gap-1.5 shrink-0 sm:gap-2">
            <button
              onClick={() => { setNavegando(true); router.push(`/${slug}/login`); }}
              className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-[13px] font-medium transition hover:border-primary/30 hover:bg-secondary sm:px-3.5 sm:text-sm"
            >
              Entrar
            </button>
            <button
              onClick={() => { setNavegando(true); router.push(`/${slug}/registro`); }}
              className="rounded-md bg-primary px-2.5 py-1.5 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition hover:opacity-90 sm:px-3.5 sm:text-sm"
            >
              Registro
            </button>
          </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-5">
        <section className="relative overflow-hidden py-12 text-center sm:py-16">
                <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.14] blur-[100px]"
      />
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent-foreground">
              Reserva online
            </span>
          </div>

          <h1 className="font-serif text-5xl font-semibold tracking-tight sm:text-6xl">
            {barberia.nombre}
          </h1>
          <div className="mx-auto mt-4 h-px w-14 bg-primary/40" />
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Reserva tu cita en segundos, sin llamadas ni esperas.
          </p>

          <button
            onClick={() => (usuario ? router.push(`/${slug}/reservar`) : setMostrarModal(true))}
            className="group mt-10 inline-flex items-center gap-2 rounded-md bg-primary px-8 py-4 text-sm font-medium text-primary-foreground shadow-[0_8px_30px_-6px_oklch(0.40_0.16_222_/_0.45)] transition hover:-translate-y-1 hover:shadow-[0_14px_40px_-8px_oklch(0.40_0.16_222_/_0.55)]"
          >
            Reservar cita
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </button>
        </section>

        {/* Servicios */}
        {servicios.length > 0 && (
          <section className="mx-auto max-w-2xl pb-10">
            <div className="mb-5 flex items-center gap-3">
              <h2 className="font-serif text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Servicios
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_2px_8px_-2px_rgba(35,28,15,0.08),0_20px_44px_-16px_rgba(35,28,15,0.18)]">
              {servicios.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50 ${
                    i !== 0 ? "border-t border-border" : ""
                  }`}
                >
                  {s.icono && (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-base">
                      {s.icono}
                    </span>
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{s.nombre}</div>
                    {s.descripcion ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">{s.descripcion}</div>
                    ) : (
                      <div className="mt-0.5 text-xs text-muted-foreground">{s.duracion_min} min</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-lg font-semibold tabular-nums text-primary">{s.precio}€</div>
                    <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{s.duracion_min} min</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Horario */}
        {horarioSemanal.length > 0 && (
          <section className="mx-auto max-w-2xl pb-24">
            <div className="mb-5 flex items-center gap-3">
              <h2 className="font-serif text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Horario
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_2px_8px_-2px_rgba(35,28,15,0.08),0_20px_44px_-16px_rgba(35,28,15,0.18)]">
              {horarioPorDia().map(({ dia, franjas }, i) => {
                const hoy = (new Date().getDay() + 6) % 7; // 0=lunes
                const esHoy = i === hoy;
                return (
                  <div
                    key={dia}
                    className={`flex items-center justify-between gap-3 px-5 py-3 ${i !== 0 ? "border-t border-border" : ""} ${
                      esHoy ? "bg-accent/40" : ""
                    }`}
                  >
                    <span className={`text-sm shrink-0 ${esHoy ? "font-semibold text-accent-foreground" : "text-foreground"}`}>
                      {dia}
                    </span>
                    <span className={`text-sm text-right whitespace-nowrap tabular-nums ${franjas.length === 0 ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                      {franjas.length > 0 ? franjas.join(" · ") : "Cerrado"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Modal: iniciar sesión para reservar */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMostrarModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-serif text-lg font-semibold tracking-tight">Inicia sesión para reservar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Necesitas una cuenta para gestionar tus citas.
            </p>
            <div className="mt-6 space-y-2">
              <button
                onClick={() => router.push(`/${slug}/login?redirect=/${slug}/reservar`)}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition hover:opacity-90"
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => router.push(`/${slug}/registro`)}
                className="w-full rounded-md border border-border bg-transparent px-4 py-2.5 text-sm font-medium transition hover:bg-secondary"
              >
                Crear cuenta
              </button>
              <button
                onClick={() => setMostrarModal(false)}
                className="w-full py-2 text-sm text-muted-foreground transition hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {navegando && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <svg className="h-6 w-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Footer nav */}
      {usuario && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-around px-4 py-3">
            <button
              onClick={() => setPestana("inicio")}
              className={`flex flex-col items-center gap-1 transition-colors ${pestana === "inicio" ? "text-primary" : "text-muted-foreground"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wider">Inicio</span>
            </button>
            <button
              onClick={() => setPestana("reservas")}
              className={`flex flex-col items-center gap-1 transition-colors ${pestana === "reservas" ? "text-primary" : "text-muted-foreground"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wider">Reservas</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}