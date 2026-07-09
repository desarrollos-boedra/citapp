import { auth } from "@/lib/auth-config";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("reservas")
    .select("id, fecha_hora, estado, notas, servicio:servicio_id(nombre, precio, duracion_min)")
    .eq("usuario_id", session.user.id)
    .order("fecha_hora", { ascending: false });

  return NextResponse.json(data ?? []);
}