import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esGestor } from "@/lib/alcance";

const Esquema = z.object({
  nombre: z.string().min(1).optional(),
  liderId: z.string().nullable().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await leerSesion();
  if (!esGestor(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { id } = await params;
  const red = await db.red.findUnique({ where: { id } });
  if (!red || !red.activo)
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  if (!s!.iglesias.includes(red.iglesiaId))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  if (datos.data.liderId) {
    const u = await db.usuario.findFirst({
      where: {
        id: datos.data.liderId,
        activo: true,
        rol: "LIDER_RED",
        iglesias: { some: { iglesiaId: red.iglesiaId } },
      },
      select: { id: true },
    });
    if (!u)
      return NextResponse.json({ error: "Líder inválido" }, { status: 400 });
    // Si la red ya tiene otro líder activo, se bloquea (primero se libera).
    const actual = await db.red.findFirst({
      where: { id },
      select: { liderId: true },
    });
    if (actual?.liderId && actual.liderId !== datos.data.liderId) {
      const otro = await db.usuario.findFirst({
        where: { id: actual.liderId, activo: true },
        select: { id: true },
      });
      if (otro)
        return NextResponse.json(
          { error: "Esa red ya tiene líder" },
          { status: 400 }
        );
    }
  }
  const actualizada = await db.red.update({
    where: { id },
    data: {
      ...(datos.data.nombre ? { nombre: datos.data.nombre } : {}),
      ...(datos.data.liderId !== undefined
        ? { liderId: datos.data.liderId }
        : {}),
    },
  });
  if (datos.data.liderId) {
    // Un líder, una red: libera otras y sincroniza su alcance. Los grupos que
    // lideraba en otra red también se liberan (lidera grupos de su red).
    await db.red.updateMany({
      where: { liderId: datos.data.liderId, id: { not: id } },
      data: { liderId: null },
    });
    await db.grupo.updateMany({
      where: { liderId: datos.data.liderId, redId: { not: id } },
      data: { liderId: null },
    });
    const u = await db.usuario.findUnique({
      where: { id: datos.data.liderId },
      select: { grupoId: true },
    });
    let grupoId: string | null | undefined;
    if (u?.grupoId) {
      const g = await db.grupo.findFirst({
        where: { id: u.grupoId, redId: id },
        select: { id: true },
      });
      if (!g) grupoId = null;
    }
    await db.usuario.update({
      where: { id: datos.data.liderId },
      data: { redId: id, ...(grupoId === null ? { grupoId: null } : {}) },
    });
  }
  return NextResponse.json(actualizada);
}
