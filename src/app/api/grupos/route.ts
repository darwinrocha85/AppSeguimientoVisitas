import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esGestor } from "@/lib/alcance";

const EsquemaGrupo = z.object({
  nombre: z.string().min(1),
  redId: z.string().min(1),
  liderId: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const url = new URL(req.url);
  const redId = url.searchParams.get("redId");
  const iglesiaId = url.searchParams.get("iglesiaId");
  const where: Record<string, unknown> = { activo: true };
  if (s.rol === "SUPERADMIN") {
    if (redId) where.redId = redId;
    if (iglesiaId) where.iglesiaId = iglesiaId;
  } else {
    const redOk = redId
      ? await db.red.findFirst({
          where: { id: redId, iglesiaId: { in: s.iglesias }, activo: true },
          select: { id: true },
        })
      : null;
    if (redId && !redOk) where.redId = "__sin_acceso__";
    else if (redId) where.redId = redId;
    else if (iglesiaId && s.iglesias.includes(iglesiaId))
      where.iglesiaId = iglesiaId;
    else where.iglesiaId = { in: s.iglesias };
  }
  const grupos = await db.grupo.findMany({
    where,
    include: { lider: { select: { id: true, nombre: true, apellido: true } } },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(grupos);
}

export async function POST(req: Request) {
  const s = await leerSesion();
  if (!esGestor(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const datos = EsquemaGrupo.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const red = await db.red.findFirst({
    where: {
      id: datos.data.redId,
      activo: true,
      iglesiaId: { in: s!.iglesias },
    },
  });
  if (!red)
    return NextResponse.json({ error: "Red inválida" }, { status: 400 });
  if (datos.data.liderId) {
    const u = await db.usuario.findFirst({
      where: {
        id: datos.data.liderId,
        activo: true,
        rol: "LIDER_GRUPO",
        iglesias: { some: { iglesiaId: red.iglesiaId } },
      },
      select: { id: true },
    });
    if (!u)
      return NextResponse.json({ error: "Líder inválido" }, { status: 400 });
  }
  const grupo = await db.grupo.create({
    data: {
      nombre: datos.data.nombre,
      redId: red.id,
      iglesiaId: red.iglesiaId,
      liderId: datos.data.liderId ?? null,
    },
  });
  return NextResponse.json(grupo, { status: 201 });
}
