import { createClient } from "@supabase/supabase-js";

// Cliente con permisos de servicio (bypassa RLS).
// Usar SOLO en API routes / código de servidor, nunca en el cliente.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}
