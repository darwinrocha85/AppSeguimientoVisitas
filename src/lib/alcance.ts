import { db } from "./db";
import type { Sesion } from "./auth";

/**
 * Alcance organizativo por rol, aplicado en el servidor.
 * - SUPERADMIN: todo (puede filtrar por iglesiaId explícita).
 * - PASTOR / LIDER_CONSOLIDADOR: sus iglesias (máx 2).
 * - LIDER_RED: su red. LIDER_GRUPO: su grupo. CONSOLIDADOR: sus asignados.
 * Nunca se revelan iglesias fuera del alcance propio (p. ej. otras
 * iglesias del pastor a líderes de red/grupo).
 */
export async function filtroVisitantes(s: Sesion, iglesiaId?: string | null) {
  if (s.rol === "SUPERADMIN") {
    return iglesiaId ? { iglesiaId } : {};
  }
  if (s.iglesias.length === 0) return { iglesiaId: "__sin_acceso__" };
  const base: Record<string, unknown> = iglesiaId
    ? s.iglesias.includes(iglesiaId)
      ? { iglesiaId }
      : { iglesiaId: "__sin_acceso__" }
    : { iglesiaId: { in: s.iglesias } };

  if (
    s.rol === "LIDER_RED" ||
    s.rol === "LIDER_GRUPO" ||
    s.rol === "CONSOLIDADOR"
  ) {
    const u = await db.usuario.findUnique({
      where: { id: s.sub },
      select: { redId: true, grupoId: true },
    });
    if (s.rol === "LIDER_RED" && u?.redId) base.redId = u.redId;
    else if (s.rol === "LIDER_GRUPO" && u?.grupoId) base.grupoId = u.grupoId;
    else if (s.rol === "CONSOLIDADOR") base.consolidadorId = s.sub;
  }
  return base;
}
export async function iglesiasDelAlcance(s: Sesion, iglesiaId?: string | null) {
  if (s.rol === "SUPERADMIN") {
    if (iglesiaId) {
      const existe = await db.iglesia.findUnique({
        where: { id: iglesiaId },
        select: { id: true, activo: true },
      });
      return existe && existe.activo ? [iglesiaId] : [];
    }
    const todas = await db.iglesia.findMany({
      where: { activo: true },
      select: { id: true },
    });
    return todas.map((i) => i.id);
  }
  // Intersecta con iglesias activas (una desactivada sale del alcance).
  const activas = await db.iglesia.findMany({
    where: { id: { in: s.iglesias }, activo: true },
    select: { id: true },
  });
  const ids = activas.map((i) => i.id);
  if (iglesiaId) return ids.includes(iglesiaId) ? [iglesiaId] : [];
  return ids;
}

/**
 * Valida que redId/grupoId pertenezcan al alcance del usuario.
 * Los líderes ven siempre su propia red/grupo, sin importar el filtro.
 * Nunca amplía el alcance: un id fuera de alcance se ignora.
 */
export async function validarRedGrupo(
  s: Sesion,
  iglesiaIds: string[],
  redId?: string | null,
  grupoId?: string | null
): Promise<{ redId?: string; grupoId?: string }> {
  if (s.rol === "LIDER_RED" || s.rol === "LIDER_GRUPO") {
    const u = await db.usuario.findUnique({
      where: { id: s.sub },
      select: { redId: true, grupoId: true },
    });
    if (s.rol === "LIDER_RED" && u?.redId) return { redId: u.redId };
    if (s.rol === "LIDER_GRUPO" && u?.grupoId) return { grupoId: u.grupoId };
    return {};
  }
  let redOk: string | undefined;
  let grupoOk: string | undefined;
  if (redId) {
    const r = await db.red.findFirst({
      where: { id: redId, activo: true },
      select: { id: true, iglesiaId: true },
    });
    if (r && (s.rol === "SUPERADMIN" || iglesiaIds.includes(r.iglesiaId))) {
      redOk = r.id;
    }
  }
  if (grupoId) {
    const g = await db.grupo.findFirst({
      where: { id: grupoId, activo: true },
      select: { id: true, iglesiaId: true, redId: true },
    });
    const enAlcance =
      g && (s.rol === "SUPERADMIN" || iglesiaIds.includes(g.iglesiaId));
    if (enAlcance && g && (!redOk || g.redId === redOk)) grupoOk = g.id;
  }
  return { redId: redOk, grupoId: grupoOk };
}

/**
 * Valida el filtro de consolidador raso (cascada del grupo).
 * El consolidador siempre se ve a sí mismo. Un id fuera de alcance
 * (otra iglesia/grupo o no raso) se ignora sin ampliar nada.
 */
export async function validarConsolidador(
  s: Sesion,
  iglesiaIds: string[],
  grupoIdValidado: string | undefined,
  consolidadorId?: string | null
): Promise<string | undefined> {
  if (s.rol === "CONSOLIDADOR") return s.sub;
  if (!consolidadorId) return undefined;
  const c = await db.usuario.findUnique({
    where: { id: consolidadorId },
    select: {
      id: true,
      rol: true,
      grupoId: true,
      iglesias: { select: { iglesiaId: true } },
    },
  });
  if (!c || c.rol !== "CONSOLIDADOR") return undefined;
  const enAlcance =
    s.rol === "SUPERADMIN" ||
    c.iglesias.some((x) => iglesiaIds.includes(x.iglesiaId));
  if (!enAlcance) return undefined;
  if (grupoIdValidado && c.grupoId !== grupoIdValidado) return undefined;
  return c.id;
}
