"use client";
import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function ResetPasswordPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (res.ok) {
      setExito(true);
      setTimeout(() => router.push(`/${slug}/login`), 2000);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al cambiar la contraseña.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href={`/${slug}`} className="inline-flex flex-col items-center gap-1.5 font-semibold">
            <Image src="/boedra-logo.png" alt="Boedra" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="text-xl tracking-tight">CitApp</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          {exito ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary text-2xl text-primary-foreground">✓</div>
              <h1 className="text-xl font-semibold tracking-tight">Contraseña cambiada</h1>
              <p className="mt-2 text-sm text-muted-foreground">Redirigiendo al login...</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Nueva contraseña</h1>
              <p className="mt-1 text-sm text-muted-foreground">Introduce tu nueva contraseña.</p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Nueva contraseña</span>
                  <input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Confirmar contraseña</span>
                  <input
                    type="password"
                    placeholder="Repite la contraseña"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
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
                  disabled={loading || !token}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Cambiando..." : "Cambiar contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}