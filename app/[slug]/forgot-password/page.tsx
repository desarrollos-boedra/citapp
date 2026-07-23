"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const { slug } = useParams<{ slug: string }>();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, slug }),
    });
    setLoading(false);
    setEnviado(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <Link
          href={`/${slug}/login`}
          className="mb-4 block text-left text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Volver
        </Link>

        <div className="mb-8 text-center">
          <Link href={`/${slug}`} className="inline-flex flex-col items-center gap-1.5 font-semibold">
            <Image src="/boedra-logo.png" alt="Boedra" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="text-xl tracking-tight">CitApp</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          {enviado ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-accent text-2xl">✉️</div>
              <h1 className="text-xl font-semibold tracking-tight">Email enviado</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Si existe una cuenta con ese email, recibirás un enlace para recuperar tu contraseña en breve.
              </p>
              <Link
                href={`/${slug}/login`}
                className="mt-6 block text-sm text-primary hover:underline"
              >
                Volver al login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">¿Olvidaste tu contraseña?</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Introduce tu email y te enviaremos un enlace para recuperarla.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Email</span>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}