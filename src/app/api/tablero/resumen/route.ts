import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import {
  filtroVisitantes,
  iglesiasDelAlcance,
  validarConsolidador,
  validarRedGrupo,
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
  const iglesiaId =
    s.rol === "SUPERADMIN" ? url.searchParams.get("iglesiaId") : null;

  const ids = await iglesiasDelAlcance(s, iglesiaId);
  // Cascada: la red debe ser de una iglesia del alcance y el grupo de esa red.
  const rg = await validarRedGrupo(
    s,
    ids,
    url.searchParams.get("redId"),
    url.searchParams.get("grupoId")
  );
  const baseV = (await filtroVisitantes(
    s,
    s.rol === "SUPERADMIN" ? iglesiaId : null
  )) as Record<string, unknown>;
  const conId = await validarConsolidador(
    s,
    ids,
    rg.grupoId,
    url.searchParams.get("consolidadorId")
  );
  const whereV: Record<string, unknown> = {
    ...baseV,
    activo: true,
    ...(rg.redId ? { redId: rg.redId } : {}),
    ...(rg.grupoId ? { grupoId: rg.grupoId } : {}),
    ...(conId ? { consolidadorId: conId } : {}),
  };

  const [porEstado, porIglesia, porRed, porGrupo, porConso, total] =
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
  // Consolidadores rasos del alcance para el 4º dropdown en cascada.
  const rasos =
    s.rol === "CONSOLIDADOR"
      ? []
      : await db.usuario.findMany({
          where: {
            rol: "CONSOLIDADOR",
            activo: true,
            iglesias: { some: { iglesiaId: { in: ids } } },
          },
          select: { id: true, nombre: true, apellido: true, grupoId: true },
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
    filtroAplicado: {
      iglesiaId: ids.length === 1 ? ids[0] : null,
      redId: rg.redId ?? null,
      grupoId: rg.grupoId ?? null,
      consolidadorId: conId ?? null,
    },
  });
}
