import { db } from "./db";
import type { Prisma } from "@prisma/client";
import type { Sesion } from "./auth";

/** Pastores y líderes consolidadores gestionan la estructura de SUS iglesias. */
export function esGestor(s: Sesion | null) {
  return !!s && (s.rol === "PASTOR" || s.rol === "LIDER_CONSOLIDADOR");
}

/**
 * Asignado = tiene red, grupo o consolidador (al menos uno).
 * No asignado = solo iglesia (sin red, sin grupo y sin consolidador).
 * Los no asignados solo se ven en su tab de pastor/líder consolidador:
 * fuera de ahí se excluyen de listas, tarjetas y estadísticas.
 */
export const ASIGNADO = {
  OR: [
    { redId: { not: null } },
    { grupoId: { not: null } },
    { consolidadorId: { not: null } },
  ],
} as const;

export const SIN_ASIGNAR = {
  redId: null,
  grupoId: null,
  consolidadorId: null,
} as const;

/**
 * No asignado para 2do contacto (DERIVADO, no es enum):
 * ya recibió el 1er contacto pero no tiene consolidador asignado para el
 * 2do. Orden: Desea > 1er > No asignado 2do > 2do > Visita.
 * Usa el límite de PRIMER_CONTACTO; en estadísticas sigue contando como
 * PRIMER_CONTACTO (no altera fecha_cambio_estado ni % éxito).
 *
 * Bandeja única "No asignados": unión de SIN_ASIGNAR (solo iglesia) y
 * SIN_CONSOLIDADOR_SEGUNDO (1er contacto sin consolidador).
 */
export const SIN_CONSOLIDADOR_SEGUNDO = {
  estadoActual: "PRIMER_CONTACTO",
  consolidadorId: null,
} as const;

/** Unión para la bandeja y tarjeta únicas de "No asignados". */
export const NECESITA_ASIGNACION: Prisma.VisitanteWhereInput = {
  OR: [
    { redId: null, grupoId: null, consolidadorId: null },
    { estadoActual: "PRIMER_CONTACTO", consolidadorId: null },
  ],
};

/**
 * Roles que pueden recibir visitantes asignados (ejercer consolidación)
 * sin duplicar su cuenta: el raso consolida en su grupo, y los líderes
 * pueden consolidar visitantes de su alcance (misma iglesia; si tienen
 * red/grupo fijados, deben coincidir con los del visitante).
 */
export const ROLES_QUE_CONSOLIDAN = [
  "CONSOLIDADOR",
  "LIDER_RED",
  "LIDER_GRUPO",
  "LIDER_CONSOLIDADOR",
] as const;

/** Roles que ven el tab de no asignados (superadmin ve todo). */
export function veNoAsignados(s: Sesion | null) {
  return (
    !!s &&
    (s.rol === "SUPERADMIN" ||
      s.rol === "PASTOR" ||
      s.rol === "LIDER_CONSOLIDADOR")
  );
}

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
    if (s.rol === "LIDER_RED" && u?.redId) {
      // El líder de red ve su red y puede filtrar por un grupo de su red
      // y en cascada por sus consolidadores. Un grupo fuera de su red se ignora.
      if (grupoId) {
        const g = await db.grupo.findFirst({
          where: { id: grupoId, redId: u.redId, activo: true },
          select: { id: true },
        });
        if (g) return { redId: u.redId, grupoId: g.id };
      }
      return { redId: u.redId };
    }
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
 * Valida el filtro de consolidador (cascada del grupo): rasos y líderes
 * que consolidan (ROLES_QUE_CONSOLIDAN), sin duplicar cuenta.
 * El consolidador siempre se ve a sí mismo. Un id fuera de alcance
 * (otra iglesia/grupo o rol que no consolida) se ignora sin ampliar nada.
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
      activo: true,
      grupoId: true,
      iglesias: { select: { iglesiaId: true } },
    },
  });
  if (
    !c ||
    !c.activo ||
    !(ROLES_QUE_CONSOLIDAN as readonly string[]).includes(c.rol)
  )
    return undefined;
  const enAlcance =
    s.rol === "SUPERADMIN" ||
    c.iglesias.some((x) => iglesiaIds.includes(x.iglesiaId));
  if (!enAlcance) return undefined;
  if (grupoIdValidado && c.grupoId !== grupoIdValidado) return undefined;
  // Alcance propio de líderes: el consolidador debe ser de su red/grupo.
  // Sin esto, un LIDER_RED filtrando por consolidador podía ver rasos de
  // otra red de la misma iglesia.
  if (s.rol === "LIDER_RED" || s.rol === "LIDER_GRUPO") {
    const yo = await db.usuario.findUnique({
      where: { id: s.sub },
      select: { redId: true, grupoId: true },
    });
    if (s.rol === "LIDER_GRUPO") {
      if (!yo?.grupoId || c.grupoId !== yo.grupoId) return undefined;
    } else if (s.rol === "LIDER_RED" && yo?.redId) {
      if (!c.grupoId) return undefined;
      const g = await db.grupo.findUnique({
        where: { id: c.grupoId },
        select: { redId: true },
      });
      if (!g || g.redId !== yo.redId) return undefined;
    }
  }
  return c.id;
}
