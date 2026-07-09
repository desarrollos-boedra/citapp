import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth-guard";

// GET público: leer intervalo por barberia_id (lo usa la página de reserva)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberiaId = searchParams.get("barberia_id");
  if (!barberiaId) {
    return NextResponse.json({ error: "Falta barberia_id" }, { status: 400 });
  }
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("barberias")
    .select("intervalo_min")
    .eq("id", barberiaId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ intervalo_min: data?.intervalo_min ?? 30 });
}

// PUT admin: actualizar intervalo de la barbería del admin
export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const barberiaId = guard.barberiaId;

  const body = await request.json();
  const intervalo = Number(body.intervalo_min);
  if (![10, 15, 20, 30, 45, 60].includes(intervalo)) {
    return NextResponse.json({ error: "Intervalo no válido" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("barberias")
    .update({ intervalo_min: intervalo })
    .eq("id", barberiaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}