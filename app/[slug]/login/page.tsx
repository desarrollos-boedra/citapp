"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import Image from "next/image";

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

    // Mirar el rol: si es admin, al panel; si no, a donde tocara
    const sesionRes = await fetch("/api/auth/session");
    const sesion = await sesionRes.json();

    if (sesion?.user?.rol === "admin") {
      router.push("/admin");
    } else {
      router.push(redirect);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href={`/${slug}`}
            className="mb-4 block text-left text-sm text-muted-foreground transition hover:text-foreground"
          >
            ← Volver
          </Link>

          <div className="mb-8 text-center">
            <Link href={`/${slug}`} className="inline-flex flex-col items-center gap-1.5 font-semibold">
              <Image
                src="/boedra-logo.png"
                alt="Boedra"
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 object-contain"
              />
              <span className="text-xl tracking-tight">CitApp</span>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accede a tu cuenta para gestionar tus reservas.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Email</span>
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Contraseña</span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>

            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !barberiaId}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href={`/${slug}/registro`} className="font-medium text-foreground hover:underline">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}