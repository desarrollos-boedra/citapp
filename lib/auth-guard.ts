import { auth } from "@/lib/auth-config";

/**
 * Para endpoints de ADMIN.
 * Verifica que hay sesión y que el rol es "admin".
 * Devuelve el barberia_id SACADO DEL TOKEN (no manipulable).
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user || session.user.rol !== "admin") {
    return {
      ok: false as const,
      response: Response.json({ error: "No autorizado" }, { status: 401 }),
      barberiaId: null,
    };
  }

  return {
    ok: true as const,
    response: null,
    barberiaId: session.user.barberia_id as string,
  };
}

/**
 * Para endpoints que requieren solo estar LOGUEADO (cualquier rol).
 */
export async function requireUser() {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: Response.json({ error: "No autorizado" }, { status: 401 }),
      userId: null,
      barberiaId: null,
      rol: null,
    };
  }

  return {
    ok: true as const,
    response: null,
    userId: session.user.id as string,
    barberiaId: session.user.barberia_id as string,
    rol: session.user.rol as string,
  };
}