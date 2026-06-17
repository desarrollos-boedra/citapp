import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const { id } = await request.json();
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("reservas").update({ estado: "cancelada" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
