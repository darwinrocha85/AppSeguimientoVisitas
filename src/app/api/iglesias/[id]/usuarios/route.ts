import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { iglesiasDelAlcance } from "@/lib/alcance";

/**
 * Usuarios activos asignados a una iglesia (solo lectura).
 * Aplica los filtros superiores validados (red/grupo/consolidador):
 * pastor y líder consolidador siempre visibles (nivel iglesia),
 * el resto debe coincidir con los filtros activos.
 * Desde la iglesia NO se pueden cambiar usuarios: eso se hace
 * desde el usuario (tab Usuarios o panel admin).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;

  // Alcance: la iglesia debe estar activa y dentro del alcance propio.
  const ids = await iglesiasDelAlcance(s, id);
  if (!ids.includes(id))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const url = new URL(req.url);
  const qRed = url.searchParams.get("redId");
  const qGrupo = url.searchParams.get("grupoId");
  const qConso = url.searchParams.get("consolidadorId");

  // Validar filtros contra ESTA iglesia (lo inválido se ignora).
  let redId: string | undefined;
  let grupoId: string | undefined;
  let consoId: string | undefined;
  if (qRed) {
    const r = await db.red.findFirst({
      where: { id: qRed, iglesiaId: id, activo: true },
      select: { id: true },
    });
    if (r) redId = r.id;
  }
  if (qGrupo) {
    const g = await db.grupo.findFirst({
      where: {
        id: qGrupo,
        iglesiaId: id,
        activo: true,
        ...(redId ? { redId } : {}),
      },
      select: { id: true },
    });
    if (g) grupoId = g.id;
  }
  if (qConso) {
    const c = await db.usuario.findFirst({
      where: {
        id: qConso,
        activo: true,
        rol: "CONSOLIDADOR",
        iglesias: { some: { iglesiaId: id } },
      },
      select: { id: true, grupoId: true },
    });
    if (c && (!grupoId || c.grupoId === grupoId)) consoId = c.id;
  }

  const asignados = await db.usuarioIglesia.findMany({
    where: { iglesiaId: id, usuario: { activo: true } },
    include: {
      usuario: {
        select: {
          id: true,
          usuario: true,
          nombre: true,
          apellido: true,
          telefono: true,
          rol: true,
          redId: true,
          grupoId: true,
        },
      },
    },
    orderBy: { usuario: { nombre: "asc" },
    },
  });

  // Visibilidad por rol (AGENTS.md): quien administra ve todo; los demás
  // solo su cadena (pastor y líderes de su alcance) más su propio alcance.
  // Nunca se revelan afiliaciones fuera del alcance (p. ej. pares de
  // otros grupos ni otras iglesias del pastor).
  let lista = asignados.map((a) => a.usuario);
  if (
    s.rol === "LIDER_RED" ||
    s.rol === "LIDER_GRUPO" ||
    s.rol === "CONSOLIDADOR"
  ) {
    const yo = await db.usuario.findUnique({
      where: { id: s.sub },
      select: { redId: true, grupoId: true },
    });
    let miRed = yo?.redId ?? null;
    if (!miRed && yo?.grupoId) {
      const g = await db.grupo.findUnique({
        where: { id: yo.grupoId },
        select: { redId: true },
      });
      miRed = g?.redId ?? null;
    }
    const CADENA = ["PASTOR", "LIDER_CONSOLIDADOR"];
    lista = lista.filter((u) => {
      if (CADENA.includes(u.rol)) return true;
      if (s.rol === "LIDER_RED") return u.redId === yo?.redId;
      if (s.rol === "LIDER_GRUPO")
        return (
          u.grupoId === yo?.grupoId ||
          (u.rol === "LIDER_RED" && u.redId === miRed)
        );
      return (
        (u.rol === "LIDER_RED" && u.redId === miRed) ||
        (u.rol === "LIDER_GRUPO" && u.grupoId === yo?.grupoId)
      );
    });
  }

  // Filtros superiores: pastor y líder consolidador son nivel iglesia
  // (siempre visibles); el resto debe coincidir con los filtros activos.
  // Pertenecer a la red incluye ser miembro de uno de sus grupos.
  if (redId || grupoId || consoId) {
    const NIVEL_IGLESIA = ["PASTOR", "LIDER_CONSOLIDADOR"];
    let gruposDeRed: string[] = [];
    if (redId) {
      const gs = await db.grupo.findMany({
        where: { redId, iglesiaId: id, activo: true },
        select: { id: true },
      });
      gruposDeRed = gs.map((g) => g.id);
    }
    lista = lista.filter((u) => {
      if (NIVEL_IGLESIA.includes(u.rol)) return true;
      if (
        redId &&
        !(u.redId === redId || (u.grupoId !== null && gruposDeRed.includes(u.grupoId)))
      )
        return false;
      if (grupoId && u.grupoId !== grupoId) return false;
      if (consoId && u.id !== consoId) return false;
      return true;
    });
  }

  return NextResponse.json(
    await Promise.all(
      lista.map(async (u) => {
        const [r, g] = await Promise.all([
          u.redId
            ? db.red.findUnique({
                where: { id: u.redId },
                select: { nombre: true },
              })
            : null,
          u.grupoId
            ? db.grupo.findUnique({
                where: { id: u.grupoId },
                select: { nombre: true },
              })
            : null,
        ]);
        return {
          id: u.id,
          usuario: u.usuario,
          nombre: u.nombre,
          apellido: u.apellido,
          telefono: u.telefono,
          rol: u.rol,
          red: r?.nombre ?? null,
          grupo: g?.nombre ?? null,
        };
      })
    )
  );
}
