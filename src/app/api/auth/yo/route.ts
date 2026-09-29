import { NextResponse } from "next/server";
import { cerrarSesion, leerSesion } from "@/lib/auth";

export async function GET() {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ autenticado: false }, { status: 401 });
  return NextResponse.json({ autenticado: true, ...s });
}

export async function POST() {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
}
