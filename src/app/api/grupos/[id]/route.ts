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
  const grupo = await db.grupo.findUnique({ where: { id } });
  if (!grupo || !grupo.activo)
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  if (!s!.iglesias.includes(grupo.iglesiaId))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  if (datos.data.liderId) {
    // El líder de red también puede liderar un grupo (de su propia red).
    const u = await db.usuario.findFirst({
      where: {
        id: datos.data.liderId,
        activo: true,
        rol: { in: ["LIDER_GRUPO", "LIDER_RED"] },
        iglesias: { some: { iglesiaId: grupo.iglesiaId } },
      },
      select: { id: true, rol: true, redId: true },
    });
    if (!u)
      return NextResponse.json({ error: "Líder inválido" }, { status: 400 });
    if (u.rol === "LIDER_RED" && u.redId !== grupo.redId)
      return NextResponse.json(
        { error: "El grupo debe ser de su red" },
        { status: 400 }
      );
    // Si el grupo ya tiene otro líder activo, se bloquea (primero se libera).
    const actual = await db.grupo.findFirst({
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
          { error: "Ese grupo ya tiene líder" },
          { status: 400 }
        );
    }
  }
  const actualizado = await db.grupo.update({
    where: { id },
    data: {
      ...(datos.data.nombre ? { nombre: datos.data.nombre } : {}),
      ...(datos.data.liderId !== undefined
        ? { liderId: datos.data.liderId }
        : {}),
    },
  });
  if (datos.data.liderId) {
    // Un líder, un grupo: libera otros y sincroniza su alcance.
    await db.grupo.updateMany({
      where: { liderId: datos.data.liderId, id: { not: id } },
      data: { liderId: null },
    });
    await db.usuario.update({
      where: { id: datos.data.liderId },
      data: { grupoId: id },
    });
  }
  return NextResponse.json(actualizado);
}
