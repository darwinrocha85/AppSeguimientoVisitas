import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esSuperadmin, puedeSuperadminCrearRol } from "@/lib/permisos";
import { TELEFONO_AYUDA, TELEFONO_REGEX } from "@/lib/telefono";

const EsquemaCrear = z.object({
  usuario: z.string().min(3),
  contrasena: z.string().min(6),
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  telefono: z.string().regex(TELEFONO_REGEX, TELEFONO_AYUDA).optional(),
  rol: z.enum([
    "PASTOR",
    "LIDER_CONSOLIDADOR",
    "LIDER_RED",
    "LIDER_GRUPO",
    "CONSOLIDADOR",
  ]),
  iglesiaIds: z.array(z.string()).min(1).max(2),
});

// Nunca devolver el hash. El teléfono/nombre solo para el alcance autorizado.
function sinHash(u: Record<string, unknown>) {
  const { passwordHash, ...resto } = u;
  void passwordHash;
  return resto;
}

export async function GET() {
  const s = await leerSesion();
  if (!esSuperadmin(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const usuarios = await db.usuario.findMany({
    where: {
      rol: { in: ["PASTOR", "LIDER_CONSOLIDADOR", "SUPERADMIN"] },
      activo: true,
    },
    include: {
      iglesias: {
        where: { iglesia: { activo: true } },
        include: { iglesia: true },
      },
    },
    orderBy: { usuario: "asc" },
  });
  // Nombres de red/grupo para mostrar afiliaciones (sin relaciones en el esquema).
  const redIds = [...new Set(usuarios.map((u) => u.redId).filter(Boolean))];
  const grupoIds = [...new Set(usuarios.map((u) => u.grupoId).filter(Boolean))];
  const [redes, grupos] = await Promise.all([
    redIds.length > 0
      ? await db.red.findMany({ where: { id: { in: redIds as string[] } } })
      : [],
    grupoIds.length > 0
      ? await db.grupo.findMany({
          where: { id: { in: grupoIds as string[] } },
        })
      : [],
  ]);
  const nombreRed = Object.fromEntries(redes.map((r) => [r.id, r.nombre]));
  const nombreGrupo = Object.fromEntries(grupos.map((g) => [g.id, g.nombre]));
  return NextResponse.json(
    usuarios.map((u) => ({
      ...sinHash(u),
      red: u.redId ? (nombreRed[u.redId] ?? null) : null,
      grupo: u.grupoId ? (nombreGrupo[u.grupoId] ?? null) : null,
    }))
  );
}

export async function POST(req: Request) {
  const s = await leerSesion();
  if (!esSuperadmin(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const datos = EsquemaCrear.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json(
      { error: "Datos inválidos", detalle: datos.error.flatten() },
      { status: 400 }
    );
  if (!puedeSuperadminCrearRol(datos.data.rol))
    return NextResponse.json(
      { error: "Superadmin solo puede crear pastor y líder consolidador" },
      { status: 403 }
    );

  const existe = await db.usuario.findUnique({
    where: { usuario: datos.data.usuario },
  });
  if (existe)
    return NextResponse.json(
      { error: "Ese usuario ya existe" },
      { status: 409 }
    );

  const passwordHash = await bcrypt.hash(datos.data.contrasena, 10);
  const creado = await db.usuario.create({
    data: {
      usuario: datos.data.usuario,
      passwordHash,
      nombre: datos.data.nombre,
      apellido: datos.data.apellido,
      telefono: datos.data.telefono,
      rol: datos.data.rol,
      iglesias: {
        create: datos.data.iglesiaIds.map((iglesiaId) => ({ iglesiaId })),
      },
    },
    include: { iglesias: { include: { iglesia: true } } },
  });
  return NextResponse.json(sinHash(creado), { status: 201 });
}
