import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esGestor } from "@/lib/alcance";
import { esSuperadmin } from "@/lib/permisos";
import { TELEFONO_AYUDA, TELEFONO_REGEX } from "@/lib/telefono";

const ROLES_BAJOS = ["LIDER_RED", "LIDER_GRUPO", "CONSOLIDADOR"] as const;

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
  redId: z.string().nullable().optional(),
  grupoId: z.string().nullable().optional(),
});

// Nunca devolver el hash. El teléfono/nombre solo para el alcance autorizado.
function sinHash(u: Record<string, unknown>) {
  const { passwordHash, ...resto } = u;
  void passwordHash;
  return resto;
}

export async function GET(req: Request) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const gestor = esGestor(s);
  if (!esSuperadmin(s) && !gestor)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const url = new URL(req.url);
  const qIglesia = url.searchParams.get("iglesiaId");
  const qRed = url.searchParams.get("redId");
  const qGrupo = url.searchParams.get("grupoId");
  const qConso = url.searchParams.get("consolidadorId");
  const esSA = esSuperadmin(s);
  // Gestores: todo se intersecta con SUS iglesias (nunca más allá).
  const propias = esSA ? null : s.iglesias;

  // Filtros validados (lo inválido se ignora sin ampliar nada).
  let iglesiaId: string | undefined;
  if (qIglesia) {
    const ig = await db.iglesia.findFirst({
      where: {
        id: qIglesia,
        activo: true,
        ...(propias ? { id: { in: propias } } : {}),
      },
      select: { id: true },
    });
    if (ig) iglesiaId = ig.id;
  }
  let red: { id: string; iglesiaId: string } | null = null;
  if (qRed) {
    red = await db.red.findFirst({
      where: {
        id: qRed,
        activo: true,
        ...(iglesiaId ? { iglesiaId } : propias ? { iglesiaId: { in: propias } } : {}),
      },
      select: { id: true, iglesiaId: true },
    });
  }
  let grupo: { id: string; iglesiaId: string } | null = null;
  if (qGrupo) {
    grupo = await db.grupo.findFirst({
      where: {
        id: qGrupo,
        activo: true,
        ...(iglesiaId ? { iglesiaId } : propias ? { iglesiaId: { in: propias } } : {}),
        ...(red ? { redId: red.id } : {}),
      },
      select: { id: true, iglesiaId: true, redId: true },
    });
  }
  // Filtrar por consolidador = solo ese usuario más el nivel iglesia de
  // su(s) iglesia(s) (pastor/líder consolidador, siempre visibles).
  // Lo inválido se ignora sin ampliar nada.
  let consoId: string | undefined;
  let iglesiasConso: string[] | null = null;
  if (qConso) {
    const c = await db.usuario.findFirst({
      where: {
        id: qConso,
        activo: true,
        rol: { in: ["CONSOLIDADOR", "LIDER_RED", "LIDER_GRUPO", "LIDER_CONSOLIDADOR"] },
        ...(propias
          ? { iglesias: { some: { iglesiaId: { in: propias } } } }
          : {}),
        ...(iglesiaId ? { iglesias: { some: { iglesiaId } } } : {}),
      },
      select: {
        id: true,
        iglesias: { select: { iglesiaId: true } },
      },
    });
    if (c) {
      consoId = c.id;
      const todas = c.iglesias.map((x) => x.iglesiaId);
      iglesiasConso = propias
        ? todas.filter((id) => propias.includes(id))
        : todas;
    }
  }

  // Pertenecer a una red incluye ser miembro de uno de sus grupos
  // (el líder de grupo solo guarda grupoId, sin redId directa).
  let gruposDeRed: string[] = [];
  if (red) {
    const gs = await db.grupo.findMany({
      where: { redId: red.id, activo: true },
      select: { id: true },
    });
    gruposDeRed = gs.map((g) => g.id);
  }

  // Pastor y líder consolidador son nivel iglesia (visibles dentro de la
  // iglesia filtrada); el resto debe coincidir con red/grupo/consolidador.
  // Superadmin ve pastores/líderes; los gestores ven todos los roles de su alcance.
  const CADENA: ("PASTOR" | "LIDER_CONSOLIDADOR" | "SUPERADMIN")[] = [
    "PASTOR",
    "LIDER_CONSOLIDADOR",
    "SUPERADMIN",
  ];
  const NIVEL_IGLESIA: string[] = esSA ? [...CADENA] : ["PASTOR", "LIDER_CONSOLIDADOR"];
  const enIglesia = (id: string) => ({ iglesias: { some: { iglesiaId: id } } });
  // Base de iglesia: filtro explícito > iglesias del consolidador > propias.
  const baseIglesia = iglesiaId
    ? enIglesia(iglesiaId)
    : iglesiasConso
      ? { iglesias: { some: { iglesiaId: { in: iglesiasConso } } } }
      : propias && !iglesiasConso
        ? { iglesias: { some: { iglesiaId: { in: propias } } } }
        : {};
  const condicionesAND: Record<string, unknown>[] = [];
  if (red) {
    const opcs: Record<string, unknown>[] = [
      { rol: { in: NIVEL_IGLESIA } },
      { redId: red.id },
    ];
    if (gruposDeRed.length > 0)
      opcs.push({ grupoId: { in: gruposDeRed } });
    condicionesAND.push({ OR: opcs });
  }
  if (grupo) {
    condicionesAND.push({
      OR: [{ rol: { in: NIVEL_IGLESIA } }, { grupoId: grupo.id }],
    });
  }
  if (consoId) {
    condicionesAND.push({
      OR: [{ rol: { in: NIVEL_IGLESIA } }, { id: consoId }],
    });
  }
  const usuarios = await db.usuario.findMany({
    where: {
      ...(esSA ? { rol: { in: CADENA } } : { rol: { not: "SUPERADMIN" } }),
      activo: true,
      ...baseIglesia,
      ...(condicionesAND.length > 0 ? { AND: condicionesAND } : {}),
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
      redId: u.redId ?? null,
      grupoId: u.grupoId ?? null,
      red: u.redId ? (nombreRed[u.redId] ?? null) : null,
      grupo: u.grupoId ? (nombreGrupo[u.grupoId] ?? null) : null,
    }))
  );
}

export async function POST(req: Request) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const datos = EsquemaCrear.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json(
      { error: "Datos inválidos", detalle: datos.error.flatten() },
      { status: 400 }
    );
  const d = datos.data;
  const esBajo = (ROLES_BAJOS as readonly string[]).includes(d.rol);
  // Pastor, líder consolidador, líder de red y líder de grupo: teléfono obligatorio.
  if (
    ["PASTOR", "LIDER_CONSOLIDADOR", "LIDER_RED", "LIDER_GRUPO"].includes(
      d.rol
    ) &&
    !d.telefono
  ) {
    return NextResponse.json(
      { error: "Teléfono obligatorio (9 dígitos)" },
      { status: 400 }
    );
  }

  if (esSuperadmin(s)) {
    // Superadmin solo crea pastor y líder consolidador (máx 2 iglesias).
    if (!["PASTOR", "LIDER_CONSOLIDADOR"].includes(d.rol))
      return NextResponse.json(
        { error: "Superadmin solo puede crear pastor y líder consolidador" },
        { status: 403 }
      );
  } else if (esGestor(s)) {
    // Pastor: roles bajos (una sola iglesia propia) y líder consolidador
    // (máx 2 iglesias propias). Líder consolidador: solo roles bajos.
    if (s.rol === "PASTOR") {
      if (d.rol === "LIDER_CONSOLIDADOR") {
        const propias = d.iglesiaIds.every((id) => s.iglesias.includes(id));
        if (d.iglesiaIds.length < 1 || d.iglesiaIds.length > 2 || !propias)
          return NextResponse.json(
            { error: "De una a dos iglesias de tu alcance" },
            { status: 400 }
          );
      } else {
        if (!esBajo)
          return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
        if (d.iglesiaIds.length !== 1 || !s.iglesias.includes(d.iglesiaIds[0]))
          return NextResponse.json(
            { error: "Una sola iglesia de tu alcance" },
            { status: 400 }
          );
      }
    } else {
      if (!esBajo)
        return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
      if (d.iglesiaIds.length !== 1 || !s.iglesias.includes(d.iglesiaIds[0]))
        return NextResponse.json(
          { error: "Una sola iglesia de tu alcance" },
          { status: 400 }
        );
    }
  } else {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  // Validar red/grupo para roles bajos (deben pertenecer a la iglesia).
  // El líder consolidador es nivel iglesia: sin red ni grupo.
  const esLiderConsol = d.rol === "LIDER_CONSOLIDADOR";
  const iglesiaId = d.iglesiaIds[0];
  // Asignación obligatoria por rol: el raso consolida en su grupo y cada
  // líder en lo suyo. Sin esto un líder sin asignación ve de más (alcance).
  if (d.rol === "CONSOLIDADOR" && (!d.redId || !d.grupoId))
    return NextResponse.json(
      { error: "El consolidador requiere red y grupo" },
      { status: 400 }
    );
  if (d.rol === "LIDER_RED" && !d.redId)
    return NextResponse.json(
      { error: "El líder de red requiere red" },
      { status: 400 }
    );
  if (d.rol === "LIDER_GRUPO" && !d.grupoId)
    return NextResponse.json(
      { error: "El líder de grupo requiere grupo" },
      { status: 400 }
    );
  if (!esLiderConsol && d.redId) {
    const r = await db.red.findFirst({
      where: { id: d.redId, iglesiaId, activo: true },
      select: { id: true },
    });
    if (!r)
      return NextResponse.json({ error: "Red inválida" }, { status: 400 });
  }
  if (!esLiderConsol && d.grupoId) {
    const g = await db.grupo.findFirst({
      where: {
        id: d.grupoId,
        iglesiaId,
        activo: true,
        ...(d.redId ? { redId: d.redId } : {}),
      },
      select: { id: true },
    });
    if (!g)
      return NextResponse.json({ error: "Grupo inválido" }, { status: 400 });
  }

  const existe = await db.usuario.findUnique({
    where: { usuario: d.usuario },
  });
  if (existe)
    return NextResponse.json(
      { error: "Ese usuario ya existe" },
      { status: 409 }
    );

  // Liderazgo directo al crear (sin paso extra en la ficha). Si la red o el
  // grupo ya tienen otro líder activo, se bloquea.
  const lideraRed = d.rol === "LIDER_RED" && !!d.redId;
  const lideraGrupo =
    (d.rol === "LIDER_GRUPO" || d.rol === "LIDER_RED") && !!d.grupoId;
  async function ocupado(
    donde: "red" | "grupo",
    id: string
  ): Promise<boolean> {
    const liderId =
      donde === "red"
        ? (await db.red.findFirst({ where: { id }, select: { liderId: true } }))
            ?.liderId
        : (
            await db.grupo.findFirst({
              where: { id },
              select: { liderId: true },
            })
          )?.liderId;
    if (!liderId) return false;
    const otro = await db.usuario.findFirst({
      where: { id: liderId, activo: true },
      select: { id: true },
    });
    return !!otro;
  }
  if (lideraRed && (await ocupado("red", d.redId!)))
    return NextResponse.json(
      { error: "Esa red ya tiene líder" },
      { status: 400 }
    );
  if (lideraGrupo && (await ocupado("grupo", d.grupoId!)))
    return NextResponse.json(
      { error: "Ese grupo ya tiene líder" },
      { status: 400 }
    );

  const passwordHash = await bcrypt.hash(d.contrasena, 10);
  const creado = await db.usuario.create({
    data: {
      usuario: d.usuario,
      passwordHash,
      nombre: d.nombre,
      apellido: d.apellido,
      telefono: d.telefono,
      rol: d.rol,
      redId: esLiderConsol ? null : (d.redId ?? null),
      grupoId: esLiderConsol ? null : (d.grupoId ?? null),
      iglesias: {
        create: d.iglesiaIds.map((id) => ({ iglesiaId: id })),
      },
    },
    include: { iglesias: { include: { iglesia: true } } },
  });
  if (lideraRed)
    await db.red.update({
      where: { id: d.redId! },
      data: { liderId: creado.id },
    });
  if (lideraGrupo)
    await db.grupo.update({
      where: { id: d.grupoId! },
      data: { liderId: creado.id },
    });
  return NextResponse.json(sinHash(creado), { status: 201 });
}
