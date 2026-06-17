import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("barberias")
    .select("id, nombre, slug, telefono")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Barbería no encontrada" }, { status: 404 });
  }

  return NextResponse.json(data);
}
