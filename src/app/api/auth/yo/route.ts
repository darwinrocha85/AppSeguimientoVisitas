import { NextResponse } from "next/server";
import { cerrarSesion, leerSesion } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ autenticado: false }, { status: 401 });
  const yo = await db.usuario.findUnique({
    where: { id: s.sub },
    select: { nombre: true, apellido: true, redId: true, grupoId: true },
  });
  // Red/grupo propios para bloquear los pills a su alcance.
  let redId: string | null = yo?.redId ?? null;
  const grupoId: string | null = yo?.grupoId ?? null;
  if (
    (s.rol === "LIDER_RED" ||
      s.rol === "LIDER_GRUPO" ||
      s.rol === "CONSOLIDADOR") &&
    !redId &&
    grupoId
  ) {
    const g = await db.grupo.findUnique({
      where: { id: grupoId },
      select: { redId: true },
    });
    redId = g?.redId ?? null;
  }
  return NextResponse.json({
    autenticado: true,
    ...s,
    nombre: yo?.nombre ?? "",
    apellido: yo?.apellido ?? "",
    redId,
    grupoId,
  });
}

export async function POST() {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
}
