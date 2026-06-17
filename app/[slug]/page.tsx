"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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

export default function HomeBarberia() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [barberia, setBarberia] = useState<Barberia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);

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

  if (cargando) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <svg className="animate-spin h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (noEncontrada || !barberia) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-white text-xl font-bold mb-2">Barbería no encontrada</h1>
          <p className="text-zinc-500 text-sm">Revisa que la dirección sea correcta.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 font-sans">
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-900 via-purple-400 to-purple-900 z-50" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-[8px] flex items-center justify-center text-zinc-950 font-bold text-sm">
            ✂
          </div>
          <span className="font-bold text-white text-sm">{barberia.nombre}</span>
        </div>
        {usuario ? (
          <span className="text-[13px] text-zinc-300">{usuario.nombre.split(" ")[0]}</span>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href={`/${slug}/login`}
              className="text-[13px] text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-1.5 rounded-full transition-all duration-200"
            >
              Entrar
            </Link>
            <Link
              href={`/${slug}/registro`}
              className="text-[13px] text-zinc-950 font-semibold bg-gradient-to-br from-purple-400 to-purple-600 px-4 py-1.5 rounded-full transition-all duration-200"
            >
              Registro
            </Link>
          </div>
        )}
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-white text-4xl font-bold mb-3">{barberia.nombre}</h1>
        <p className="text-zinc-400 mb-8">Reserva tu cita online en segundos.</p>

        <button
          onClick={() =>
            usuario ? router.push(`/${slug}/reservar`) : setMostrarModal(true)
          }
          className="bg-gradient-to-br from-purple-400 to-purple-600 text-zinc-950 font-bold py-4 px-8 rounded-2xl text-[15px] shadow-[0_8px_32px_rgba(168,85,247,0.3)] hover:-translate-y-0.5 transition-all duration-200"
        >
          Reservar cita →
        </button>

        {servicios.length > 0 && (
          <div className="mt-16 text-left">
            <h2 className="text-zinc-500 text-[11px] font-semibold uppercase tracking-widest mb-4">
              Servicios
            </h2>
            <div className="space-y-2">
              {servicios.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-4 bg-white/[0.025] border border-white/[0.06] rounded-[14px] px-4 py-3.5"
                >
                  {s.icono && <span className="text-xl">{s.icono}</span>}
                  <div className="flex-1">
                    <div className="text-white text-sm font-semibold">{s.nombre}</div>
                    <div className="text-zinc-500 text-[12px]">{s.duracion_min} min</div>
                  </div>
                  <div className="text-purple-400 font-bold">{s.precio}€</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMostrarModal(false)} />
          <div className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-1">Inicia sesión para reservar</h3>
            <p className="text-zinc-500 text-sm mb-6">Necesitas una cuenta para gestionar tus citas</p>
            <div className="space-y-2">
              <button
                onClick={() => router.push(`/${slug}/login?redirect=/${slug}/reservar`)}
                className="w-full p-4 rounded-[16px] border border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40 transition-all duration-200 text-left"
              >
                <div className="text-white text-sm font-semibold">Iniciar sesión</div>
              </button>
              <button
                onClick={() => setMostrarModal(false)}
                className="w-full mt-2 text-zinc-600 text-sm hover:text-zinc-400 transition-colors py-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
