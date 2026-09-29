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
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const actual = await db.usuario.findUnique({
    where: { id },
    include: {
      iglesias: {
        where: { iglesia: { activo: true } },
        select: { iglesiaId: true },
      },
    },
  });
  if (!actual)
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  if (actual.rol === "SUPERADMIN")
    return NextResponse.json(
      { error: "No se puede eliminar al superadmin" },
      { status: 403 }
    );

  // Quién puede desactivar a quién (borrado LÓGICO, se conserva el registro):
  // - Superadmin: ciclo de vida completo (pastor, líder consolidador y roles bajos).
  // - Pastor y líder consolidador: solo roles bajos de sus propias iglesias.
  //   El líder consolidador nunca toca al pastor.
  const esAlta =
    actual.rol === "PASTOR" || actual.rol === "LIDER_CONSOLIDADOR";
  let permitido = esSuperadmin(s);
  if (
    !permitido &&
    (s.rol === "PASTOR" || s.rol === "LIDER_CONSOLIDADOR") &&
    !esAlta
  ) {
    const mias = new Set(s.iglesias);
    permitido = actual.iglesias.some((x) => mias.has(x.iglesiaId));
  }
  if (!permitido)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  await db.usuario.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
