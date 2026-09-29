import { NextResponse } from "next/server";
import { cerrarSesion, leerSesion } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ autenticado: false }, { status: 401 });
  // Red/grupo propios para bloquear los pills a su alcance.
  let redId: string | null = null;
  let grupoId: string | null = null;
  if (
    s.rol === "LIDER_RED" ||
    s.rol === "LIDER_GRUPO" ||
    s.rol === "CONSOLIDADOR"
  ) {
    const u = await db.usuario.findUnique({
      where: { id: s.sub },
      select: { redId: true, grupoId: true },
    });
    redId = u?.redId ?? null;
    grupoId = u?.grupoId ?? null;
    if (!redId && grupoId) {
      const g = await db.grupo.findUnique({
        where: { id: grupoId },
        select: { redId: true },
      });
      redId = g?.redId ?? null;
    }
  }
  return NextResponse.json({ autenticado: true, ...s, redId, grupoId });
}

export async function POST() {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
}
