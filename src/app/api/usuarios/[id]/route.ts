import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esSuperadmin } from "@/lib/permisos";
import { TELEFONO_AYUDA, TELEFONO_REGEX } from "@/lib/telefono";

const Esquema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  telefono: z.string().regex(TELEFONO_REGEX, TELEFONO_AYUDA).nullable().optional(),
  contrasena: z.string().min(6).optional(),
  iglesiaIds: z.array(z.string()).min(1).max(2).optional(),
  activo: z.boolean().optional(),
});

function sinHash(u: Record<string, unknown>) {
  const { passwordHash, ...resto } = u;
  void passwordHash;
  return resto;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await leerSesion();
  if (!esSuperadmin(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { id } = await params;
  const actual = await db.usuario.findUnique({ where: { id } });
  if (!actual)
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  // Superadmin solo edita pastor, líder consolidador e iglesia (no otros roles).
  if (!["PASTOR", "LIDER_CONSOLIDADOR", "SUPERADMIN"].includes(actual.rol))
    return NextResponse.json(
      { error: "Superadmin solo puede editar pastor y líder consolidador" },
      { status: 403 }
    );

  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const actualizado = await db.usuario.update({
    where: { id },
    data: {
      ...(datos.data.nombre ? { nombre: datos.data.nombre } : {}),
      ...(datos.data.apellido ? { apellido: datos.data.apellido } : {}),
      ...(datos.data.telefono !== undefined
        ? { telefono: datos.data.telefono }
        : {}),
      ...(datos.data.activo !== undefined
        ? { activo: datos.data.activo }
        : {}),
      ...(datos.data.contrasena
        ? { passwordHash: await bcrypt.hash(datos.data.contrasena, 10) }
        : {}),
      ...(datos.data.iglesiaIds
        ? {
            iglesias: {
              deleteMany: {},
              create: datos.data.iglesiaIds.map((iglesiaId) => ({
                iglesiaId,
              })),
            },
          }
        : {}),
    },
    include: { iglesias: { include: { iglesia: true } } },
  });
  return NextResponse.json(sinHash(actualizado));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await leerSesion();
  if (!esSuperadmin(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { id } = await params;
  const actual = await db.usuario.findUnique({ where: { id } });
  if (!actual)
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  if (actual.rol === "SUPERADMIN")
    return NextResponse.json(
      { error: "No se puede eliminar al superadmin" },
      { status: 403 }
    );
  if (!["PASTOR", "LIDER_CONSOLIDADOR"].includes(actual.rol))
    return NextResponse.json(
      { error: "Superadmin solo puede eliminar pastor y líder consolidador" },
      { status: 403 }
    );
  await db.usuario.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
