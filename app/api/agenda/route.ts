import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberiaId = searchParams.get("barberia_id");
  if (!barberiaId) {
    return NextResponse.json({ error: "Falta barberia_id" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("agenda")
    .select("fecha, turno")
    .eq("barberia_id", barberiaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const body = await request.json(); // { barberia_id, fecha, turno }
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("agenda").insert(body);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json(); // { barberia_id, fecha, turno }
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("agenda")
    .delete()
    .eq("barberia_id", body.barberia_id)
    .eq("fecha", body.fecha)
    .eq("turno", body.turno);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
