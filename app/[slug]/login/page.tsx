"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const redirect = searchParams.get("redirect") ?? `/${slug}`;

  const [barberiaId, setBarberiaId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/barberia/${slug}`)
      .then((r) => r.json())
      .then((data) => setBarberiaId(data.id ?? null));
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!barberiaId) return;
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      barberia_id: barberiaId,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    router.push(redirect);
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-white text-2xl font-bold mb-1">Iniciar sesión</h1>
        <p className="text-zinc-500 text-sm mb-6">Accede a tu cuenta para reservar</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition-all duration-200"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition-all duration-200"
          />

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !barberiaId}
            className="w-full bg-gradient-to-br from-purple-400 to-purple-600 disabled:opacity-50 text-zinc-950 font-bold py-3.5 rounded-[14px] transition-all duration-200"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-zinc-500 text-sm mt-6 text-center">
          ¿No tienes cuenta?{" "}
          <Link href={`/${slug}/registro`} className="text-purple-400 font-semibold">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
