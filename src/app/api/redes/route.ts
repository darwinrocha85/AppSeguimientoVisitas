import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esGestor } from "@/lib/alcance";

const EsquemaRed = z.object({
  nombre: z.string().min(1),
  iglesiaId: z.string().min(1),
  liderId: z.string().nullable().optional(),
});

async function liderValido(
  liderId: string | null | undefined,
  iglesiaId: string
) {
  if (!liderId) return true;
  const u = await db.usuario.findFirst({
    where: {
      id: liderId,
      activo: true,
      rol: "LIDER_RED",
      iglesias: { some: { iglesiaId } },
    },
    select: { id: true },
  });
  return !!u;
}

export async function GET(req: Request) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const url = new URL(req.url);
  const iglesiaId = url.searchParams.get("iglesiaId");
  const where: Record<string, unknown> = { activo: true };
  if (s.rol === "SUPERADMIN") {
    if (iglesiaId) where.iglesiaId = iglesiaId;
  } else {
    where.iglesiaId = iglesiaId
      ? s.iglesias.includes(iglesiaId)
        ? iglesiaId
        : "__sin_acceso__"
      : { in: s.iglesias };
  }
  const redes = await db.red.findMany({
    where,
    include: { lider: { select: { id: true, nombre: true, apellido: true } } },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(redes);
}

export async function POST(req: Request) {
  const s = await leerSesion();
  if (!esGestor(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const datos = EsquemaRed.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  if (!s!.iglesias.includes(datos.data.iglesiaId))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const iglesia = await db.iglesia.findFirst({
    where: { id: datos.data.iglesiaId, activo: true },
    select: { id: true },
  });
  if (!iglesia)
    return NextResponse.json({ error: "Iglesia inválida" }, { status: 400 });
  if (!(await liderValido(datos.data.liderId, datos.data.iglesiaId)))
    return NextResponse.json({ error: "Líder inválido" }, { status: 400 });
  const red = await db.red.create({
    data: {
      nombre: datos.data.nombre,
      iglesiaId: datos.data.iglesiaId,
      liderId: datos.data.liderId ?? null,
    },
  });
  return NextResponse.json(red, { status: 201 });
}
