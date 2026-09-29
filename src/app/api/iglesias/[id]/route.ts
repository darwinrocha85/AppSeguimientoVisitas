import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esSuperadmin } from "@/lib/permisos";
import { TELEFONO_AYUDA, TELEFONO_REGEX } from "@/lib/telefono";

const Esquema = z.object({
  nombre: z.string().min(1).optional(),
  direccion: z.string().nullable().optional(),
  telefono: z.string().regex(TELEFONO_REGEX, TELEFONO_AYUDA).nullable().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await leerSesion();
  if (!esSuperadmin(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { id } = await params;
  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const iglesia = await db.iglesia.update({
    where: { id },
    data: {
      ...(datos.data.nombre ? { nombre: datos.data.nombre } : {}),
      ...(datos.data.direccion !== undefined
        ? { direccion: datos.data.direccion }
        : {}),
      ...(datos.data.telefono !== undefined
        ? { telefono: datos.data.telefono }
        : {}),
    },
  });
  return NextResponse.json(iglesia);
}

/**
 * Borrado LÓGICO en cascada: desactiva la iglesia y todo lo que depende
 * de ella (redes, grupos, visitantes, orígenes propios y asignaciones
 * de usuarios). Nada se borra físicamente de la base de datos.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await leerSesion();
  if (!esSuperadmin(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { id } = await params;
  const existe = await db.iglesia.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existe)
    return NextResponse.json({ error: "No existe" }, { status: 404 });

  await db.$transaction([
    db.visitante.updateMany({
      where: { iglesiaId: id },
      data: { activo: false },
    }),
    db.grupo.updateMany({
      where: { iglesiaId: id },
      data: { activo: false },
    }),
    db.red.updateMany({
      where: { iglesiaId: id },
      data: { activo: false },
    }),
    db.origen.updateMany({
      where: { iglesiaId: id },
      data: { activo: false },
    }),
    db.usuarioIglesia.deleteMany({ where: { iglesiaId: id } }),
    db.iglesia.update({ where: { id }, data: { activo: false } }),
  ]);
  return NextResponse.json({ ok: true });
}
