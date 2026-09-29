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
    const u = await db.usuario.findFirst({
      where: {
        id: datos.data.liderId,
        activo: true,
        rol: "LIDER_GRUPO",
        iglesias: { some: { iglesiaId: grupo.iglesiaId } },
      },
      select: { id: true },
    });
    if (!u)
      return NextResponse.json({ error: "Líder inválido" }, { status: 400 });
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
  return NextResponse.json(actualizado);
}
