import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esGestor } from "@/lib/alcance";
import { esSuperadmin } from "@/lib/permisos";
import { TELEFONO_AYUDA, TELEFONO_REGEX } from "@/lib/telefono";

const ROLES_BAJOS = ["LIDER_RED", "LIDER_GRUPO", "CONSOLIDADOR"] as const;

const Esquema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  telefono: z.string().regex(TELEFONO_REGEX, TELEFONO_AYUDA).nullable().optional(),
  contrasena: z.string().min(6).optional(),
  // Cambio de rol entre operativos (nunca a pastor ni líder consolidador).
  rol: z.enum(ROLES_BAJOS).optional(),
  iglesiaIds: z.array(z.string()).min(1).max(2).optional(),
  redId: z.string().nullable().optional(),
  grupoId: z.string().nullable().optional(),
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

  const esAlta =
    actual.rol === "PASTOR" ||
    actual.rol === "LIDER_CONSOLIDADOR" ||
    actual.rol === "SUPERADMIN";
  const gestor = esGestor(s);
  // Superadmin edita altas; pastor edita líder consolidador y bajos de SUS
  // iglesias (nunca a otro pastor); líder consolidador solo bajos.
  if (esSuperadmin(s)) {
    if (!esAlta)
      return NextResponse.json(
        { error: "Superadmin solo puede editar pastor y líder consolidador" },
        { status: 403 }
      );
  } else if (gestor) {
    if (actual.rol === "SUPERADMIN" || actual.rol === "PASTOR")
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    if (s.rol === "LIDER_CONSOLIDADOR" && actual.rol === "LIDER_CONSOLIDADOR")
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    const mias = new Set(s.iglesias);
    if (!actual.iglesias.some((x) => mias.has(x.iglesiaId)))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  } else {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  // Cambio de rol: solo gestores, solo entre operativos y solo si el usuario
  // ya es operativo (pastor, líder consolidador y superadmin no cambian).
  const rolFinal = datos.data.rol ?? actual.rol;
  const cambiaRol = rolFinal !== actual.rol;
  if (cambiaRol) {
    if (!gestor || esSuperadmin(s))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    if (!(ROLES_BAJOS as readonly string[]).includes(actual.rol))
      return NextResponse.json(
        { error: "Ese rol no se puede cambiar" },
        { status: 403 }
      );
  }
  // Teléfono obligatorio para pastor y los tres niveles de líderes (nuevo rol).
  const telFinal = datos.data.telefono !== undefined ? datos.data.telefono : actual.telefono;
  if (
    ["PASTOR", "LIDER_CONSOLIDADOR", "LIDER_RED", "LIDER_GRUPO"].includes(
      rolFinal
    ) &&
    !telFinal
  ) {
    return NextResponse.json(
      { error: "Teléfono obligatorio (9 dígitos)" },
      { status: 400 }
    );
  }

  // Gestores: una sola iglesia propia; red/grupo validados contra ella.
  // Pastor editando líder consolidador: de una a dos iglesias propias.
  // Pastor y líder consolidador son nivel iglesia: sin red ni grupo.
  if (gestor && !esSuperadmin(s)) {
    if (actual.rol === "PASTOR" || actual.rol === "LIDER_CONSOLIDADOR") {
      datos.data.redId = null;
      datos.data.grupoId = null;
    }
  }
  let iglesiaIds = datos.data.iglesiaIds;
  if (gestor && !esSuperadmin(s)) {
    const base = iglesiaIds ?? actual.iglesias.map((x) => x.iglesiaId);
    if (s.rol === "PASTOR" && actual.rol === "LIDER_CONSOLIDADOR") {
      const propias = base.every((id) => s.iglesias.includes(id));
      if (base.length < 1 || base.length > 2 || !propias)
        return NextResponse.json(
          { error: "De una a dos iglesias de tu alcance" },
          { status: 400 }
        );
    } else if (base.length !== 1 || !s.iglesias.includes(base[0])) {
      return NextResponse.json(
        { error: "Una sola iglesia de tu alcance" },
        { status: 400 }
      );
    }
    iglesiaIds = base;
  }
  const iglesiaFinal = iglesiaIds ? iglesiaIds[0] : actual.iglesias[0]?.iglesiaId;
  if (datos.data.redId && iglesiaFinal) {
    const r = await db.red.findFirst({
      where: { id: datos.data.redId, iglesiaId: iglesiaFinal, activo: true },
      select: { id: true },
    });
    if (!r)
      return NextResponse.json({ error: "Red inválida" }, { status: 400 });
  }
  if (datos.data.grupoId && iglesiaFinal) {
    const g = await db.grupo.findFirst({
      where: {
        id: datos.data.grupoId,
        iglesiaId: iglesiaFinal,
        activo: true,
        ...(datos.data.redId ? { redId: datos.data.redId } : {}),
      },
      select: { id: true },
    });
    if (!g)
      return NextResponse.json({ error: "Grupo inválido" }, { status: 400 });
  }

  // Asignación obligatoria por rol (editar, con el rol final): no se puede
  // dejar sin red/grupo lo que el nuevo rol exige.
  const nuevaRed = datos.data.redId;
  const nuevoGrupo = datos.data.grupoId;
  const redFinal = nuevaRed !== undefined ? nuevaRed : actual.redId;
  const grupoFinal = nuevoGrupo !== undefined ? nuevoGrupo : actual.grupoId;
  if (rolFinal === "CONSOLIDADOR" && (!redFinal || !grupoFinal))
    return NextResponse.json(
      { error: "El consolidador requiere red y grupo" },
      { status: 400 }
    );
  if (rolFinal === "LIDER_RED" && !redFinal)
    return NextResponse.json(
      { error: "El líder de red requiere red" },
      { status: 400 }
    );
  if (rolFinal === "LIDER_GRUPO" && !grupoFinal)
    return NextResponse.json(
      { error: "El líder de grupo requiere grupo" },
      { status: 400 }
    );

  // Traspaso de liderazgo al cambiar de red/grupo: libera el anterior (si lo
  // tenía) y reclama el nuevo. Destino con otro líder activo → se bloquea.
  async function destinoOcupado(
    donde: "red" | "grupo",
    destinoId: string
  ): Promise<boolean> {
    const liderId =
      donde === "red"
        ? (
            await db.red.findFirst({
              where: { id: destinoId },
              select: { liderId: true },
            })
          )?.liderId
        : (
            await db.grupo.findFirst({
              where: { id: destinoId },
              select: { liderId: true },
            })
          )?.liderId;
    if (!liderId || liderId === id) return false;
    const otro = await db.usuario.findFirst({
      where: { id: liderId, activo: true },
      select: { id: true },
    });
    return !!otro;
  }
  // Quién lidera qué con el rol final (cambio de rol o de alcance):
  // - LIDER_RED lidera su red (y opcionalmente un grupo de esa red).
  // - LIDER_GRUPO lidera su grupo. CONSOLIDADOR no lidera nada.
  // Reclama aunque la red/grupo no cambie (p. ej. consolidador que pasa a
  // líder en el mismo grupo); libera lo que el rol final ya no lidera.
  const lideraRedFinal = rolFinal === "LIDER_RED";
  const lideraGrupoFinal = rolFinal === "LIDER_GRUPO" || rolFinal === "LIDER_RED";
  const liderRedDestino = redFinal
    ? (await db.red.findFirst({ where: { id: redFinal }, select: { liderId: true } }))?.liderId ?? null
    : null;
  const liderGrupoDestino = grupoFinal
    ? (await db.grupo.findFirst({ where: { id: grupoFinal }, select: { liderId: true } }))?.liderId ?? null
    : null;
  const reclamaRed = lideraRedFinal && !!redFinal && liderRedDestino !== id;
  const reclamaGrupo = lideraGrupoFinal && !!grupoFinal && liderGrupoDestino !== id;
  const liberaRed = !!actual.redId && (!lideraRedFinal || actual.redId !== redFinal);
  const liberaGrupo = !!actual.grupoId && (!lideraGrupoFinal || actual.grupoId !== grupoFinal);
  if (reclamaRed && redFinal && (await destinoOcupado("red", redFinal)))
    return NextResponse.json(
      { error: "Esa red ya tiene líder" },
      { status: 400 }
    );
  if (reclamaGrupo && grupoFinal && (await destinoOcupado("grupo", grupoFinal)))
    return NextResponse.json(
      { error: "Ese grupo ya tiene líder" },
      { status: 400 }
    );
  // El grupo que también lidera un líder de red debe ser de su propia red.
  if (rolFinal === "LIDER_RED" && grupoFinal && redFinal) {
    const propio = await db.grupo.findFirst({
      where: { id: grupoFinal, redId: redFinal },
      select: { id: true },
    });
    if (!propio)
      return NextResponse.json(
        { error: "El grupo debe ser de su red" },
        { status: 400 }
      );
  }
  // A líder de grupo la red se deriva de su grupo (sin pedirla): así un
  // cambio de grupo a otra red no choca con la red anterior.
  let redIdFinal = datos.data.redId;
  if (rolFinal === "LIDER_GRUPO" && redIdFinal === undefined && grupoFinal) {
    const g = await db.grupo.findFirst({
      where: { id: grupoFinal },
      select: { redId: true },
    });
    if (g) redIdFinal = g.redId;
  }
  if (liberaRed && actual.redId)
    await db.red.updateMany({
      where: { id: actual.redId, liderId: id },
      data: { liderId: null },
    });
  if (liberaGrupo && actual.grupoId)
    await db.grupo.updateMany({
      where: { id: actual.grupoId, liderId: id },
      data: { liderId: null },
    });
  if (reclamaRed && redFinal)
    await db.red.update({
      where: { id: redFinal },
      data: { liderId: id },
    });
  if (reclamaGrupo && grupoFinal)
    await db.grupo.update({
      where: { id: grupoFinal },
      data: { liderId: id },
    });

  const actualizado = await db.usuario.update({
    where: { id },
    data: {
      ...(datos.data.nombre ? { nombre: datos.data.nombre } : {}),
      ...(datos.data.apellido ? { apellido: datos.data.apellido } : {}),
      ...(datos.data.telefono !== undefined
        ? { telefono: datos.data.telefono }
        : {}),
      ...(datos.data.activo !== undefined && esSuperadmin(s)
        ? { activo: datos.data.activo }
        : {}),
      ...(datos.data.contrasena
        ? { passwordHash: await bcrypt.hash(datos.data.contrasena, 10) }
        : {}),
      ...(datos.data.redId !== undefined ? { redId: datos.data.redId } : {}),
      ...(redIdFinal !== undefined && datos.data.redId === undefined
        ? { redId: redIdFinal }
        : {}),
      ...(datos.data.grupoId !== undefined
        ? { grupoId: datos.data.grupoId }
        : {}),
      ...(cambiaRol ? { rol: rolFinal } : {}),
      ...(iglesiaIds
        ? {
            iglesias: {
              deleteMany: {},
              create: iglesiaIds.map((iglesiaId) => ({
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
  // - Pastor: líder consolidador y roles bajos de sus propias iglesias (nunca a otro pastor).
  // - Líder consolidador: solo roles bajos. Nunca toca al pastor ni a otro líder.
  const ROLES_BAJOS = ["LIDER_RED", "LIDER_GRUPO", "CONSOLIDADOR"];
  let permitido = esSuperadmin(s);
  if (!permitido) {
    const mias = new Set(s.iglesias);
    const comparte = actual.iglesias.some((x) => mias.has(x.iglesiaId));
    if (
      s.rol === "PASTOR" &&
      (actual.rol === "LIDER_CONSOLIDADOR" ||
        (ROLES_BAJOS as string[]).includes(actual.rol)) &&
      comparte
    ) {
      permitido = true;
    } else if (
      s.rol === "LIDER_CONSOLIDADOR" &&
      (ROLES_BAJOS as string[]).includes(actual.rol) &&
      comparte
    ) {
      permitido = true;
    }
  }
  if (!permitido)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  await db.usuario.update({ where: { id }, data: { activo: false } });
  // Libera las redes/grupos que lideraba (si no, quedarían ocupadas por
  // alguien inactivo y bloquearían al siguiente líder).
  await db.red.updateMany({
    where: { liderId: id },
    data: { liderId: null },
  });
  await db.grupo.updateMany({
    where: { liderId: id },
    data: { liderId: null },
  });
  return NextResponse.json({ ok: true });
}
