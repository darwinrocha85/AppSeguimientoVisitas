import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import {
  NECESITA_ASIGNACION,
  filtroVisitantes,
  iglesiasDelAlcance,
  validarConsolidador,
  validarRedGrupo,
  veNoAsignados,
} from "@/lib/alcance";

/**
 * Resumen INSTANTÁNEO (foto actual, sin rango de fechas) del alcance del
 * usuario: conteos por estado actual y totales por iglesia/red/grupo.
 * Las estadísticas por rango con fecha_cambio_estado viven en Reportes.
 */
export async function GET(req: Request) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(req.url);
  // La iglesia elegida aplica para superadmin y gestores (pastor/líder);
  // iglesiasDelAlcance la intersecta con las propias (máx 2).
  const iglesiaId =
    s.rol === "SUPERADMIN" ||
    s.rol === "PASTOR" ||
    s.rol === "LIDER_CONSOLIDADOR"
      ? url.searchParams.get("iglesiaId")
      : null;

  const ids = await iglesiasDelAlcance(s, iglesiaId);
  // Cascada: la red debe ser de una iglesia del alcance y el grupo de esa red.
  const rg = await validarRedGrupo(
    s,
    ids,
    url.searchParams.get("redId"),
    url.searchParams.get("grupoId")
  );
  const baseV = (await filtroVisitantes(s, iglesiaId)) as Record<
    string,
    unknown
  >;
  const conId = await validarConsolidador(
    s,
    ids,
    rg.grupoId,
    url.searchParams.get("consolidadorId")
  );
  // Regla vigente: el 1er contacto se escribe desde la iglesia SIN asignar
  // (p. ej. mensaje masivo) y el 2do lo hace el consolidador. Por eso las
  // tarjetas cuentan TODOS los del alcance, asignados o no; con filtro de
  // red/grupo/consolidador solo cuentan los de ese nivel.
  // Las 4 tarjetas de etapa cuentan contactables; quien dijo No va a su
  // propia tarjeta "No contactar" (conserva su estado como constancia).
  const whereV: Record<string, unknown> = {
    ...baseV,
    activo: true,
    sinContacto: false,
    ...(rg.redId ? { redId: rg.redId } : {}),
    ...(rg.grupoId ? { grupoId: rg.grupoId } : {}),
    ...(conId ? { consolidadorId: conId } : {}),
  };

  // Conteo del tab de no asignados (alcance de iglesias, sin filtros de
  // red/grupo/consolidador). Solo gestores: nunca filtrar afiliaciones a líderes.
  const puedeVer = veNoAsignados(s);
  const [porEstado, porIglesia, porRed, porGrupo, porConso, total, noAsignados, noContactar] =
    await Promise.all([
      db.visitante.groupBy({ by: ["estadoActual"], where: whereV, _count: true }),
      db.visitante.groupBy({ by: ["iglesiaId"], where: whereV, _count: true }),
      db.visitante.groupBy({ by: ["redId"], where: whereV, _count: true }),
      db.visitante.groupBy({ by: ["grupoId"], where: whereV, _count: true }),
      db.visitante.groupBy({
        by: ["consolidadorId"],
        where: whereV,
        _count: true,
      }),
      db.visitante.count({ where: whereV }),
      puedeVer && ids.length > 0
        ? db.visitante.count({
            where: {
              iglesiaId: { in: ids },
              activo: true,
              ...NECESITA_ASIGNACION,
            },
          })
        : Promise.resolve(0),
      db.visitante.count({
        where: { ...whereV, sinContacto: true },
      }),
    ]);

  const iglesias =
    ids.length > 0
      ? await db.iglesia.findMany({
          where: { id: { in: ids } },
          select: { id: true, nombre: true },
          orderBy: { nombre: "asc" },
        })
      : [];
  // Opciones de cascada: TODAS las redes/grupos del alcance (aunque tengan 0).
  // Los líderes solo ven su propia red/grupo en las opciones.
  let redes = ids.length > 0
    ? await db.red.findMany({
        where: { iglesiaId: { in: ids }, activo: true },
        select: { id: true, nombre: true, iglesiaId: true },
        orderBy: { nombre: "asc" },
      })
    : [];
  let grupos = ids.length > 0
    ? await db.grupo.findMany({
        where: { iglesiaId: { in: ids }, activo: true },
        select: { id: true, nombre: true, iglesiaId: true, redId: true },
        orderBy: { nombre: "asc" },
      })
    : [];
  if (s.rol === "LIDER_RED" || s.rol === "LIDER_GRUPO") {
    const u = await db.usuario.findUnique({
      where: { id: s.sub },
      select: { redId: true, grupoId: true },
    });
    if (s.rol === "LIDER_RED" && u?.redId) {
      redes = redes.filter((r) => r.id === u.redId);
      grupos = grupos.filter((g) => g.redId === u.redId);
    }
    if (s.rol === "LIDER_GRUPO" && u?.grupoId) {
      grupos = grupos.filter((g) => g.id === u.grupoId);
    }
  }
  const conteoRed = Object.fromEntries(
    porRed.map((p) => [p.redId, p._count])
  );
  const conteoGrupo = Object.fromEntries(
    porGrupo.map((p) => [p.grupoId, p._count])
  );
  const conteoConso = Object.fromEntries(
    porConso.map((p) => [p.consolidadorId, p._count])
  );
  const alertas =
    ids.length > 0
      ? await db.alertaConfig.findMany({
          where: { iglesiaId: { in: ids } },
          select: { iglesiaId: true, estado: true, maxHoras: true },
        })
      : [];
  // Consolidadores del alcance para el 4º dropdown en cascada: rasos y
  // líderes que consolidan con la misma cuenta (sin duplicarla).
  const rasos =
    s.rol === "CONSOLIDADOR"
      ? []
      : await db.usuario.findMany({
          where: {
            rol: { in: ["CONSOLIDADOR", "LIDER_RED", "LIDER_GRUPO", "LIDER_CONSOLIDADOR"] },
            activo: true,
            iglesias: { some: { iglesiaId: { in: ids } } },
          },
          select: { id: true, nombre: true, apellido: true, grupoId: true, rol: true },
          orderBy: { nombre: "asc" },
        });

  const estados: Record<string, number> = {
    DESEA_SER_CONTACTADO: 0,
    PRIMER_CONTACTO: 0,
    SEGUNDO_CONTACTO: 0,
    VISITA_AMISTAD: 0,
  };
  for (const e of porEstado) estados[e.estadoActual] = e._count;

  return NextResponse.json({
    alcance: "actual",
    total,
    noAsignados,
    noContactar,
    porEstado: estados,
    porIglesia: porIglesia.map((p) => ({
      iglesiaId: p.iglesiaId,
      nombre: iglesias.find((i) => i.id === p.iglesiaId)?.nombre ?? "?",
      total: p._count,
    })),
    redes: redes.map((r) => ({
      ...r,
      total: conteoRed[r.id] ?? 0,
    })),
    grupos: grupos.map((g) => ({
      ...g,
      total: conteoGrupo[g.id] ?? 0,
    })),
    consolidadores: rasos.map((r) => ({
      ...r,
      total: conteoConso[r.id] ?? 0,
    })),
    alertas,
    filtroAplicado: {
      iglesiaId: ids.length === 1 ? ids[0] : null,
      redId: rg.redId ?? null,
      grupoId: rg.grupoId ?? null,
      consolidadorId: conId ?? null,
    },
  });
}
