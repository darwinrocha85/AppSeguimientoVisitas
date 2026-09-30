import { NextResponse } from "next/server";
import type { Rol } from "@prisma/client";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";

type Persona = {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  rol: string;
  detalle: string | null;
};

const BASE = { activo: true } as const;
const CORTO = {
  id: true,
  nombre: true,
  apellido: true,
  telefono: true,
  rol: true,
} as const;

/**
 * "Mi equipo" según el rol (solo lectura, dentro del alcance propio):
 * - CONSOLIDADOR: pastor, líder consolidador, líder de red y líder de grupo.
 * - LIDER_GRUPO: sus consolidadores + líder de red, pastor y líder consolidador.
 * - LIDER_RED: sus grupos (con líder y rasos) + pastor y líder consolidador.
 * - PASTOR / LIDER_CONSOLIDADOR / SUPERADMIN: equipo de una iglesia
 *   (parámetro iglesiaId; gestores usan una de las suyas).
 * Nunca incluye afiliaciones a otras iglesias: solo personas y nombres
 * del alcance actual.
 */
export async function GET(req: Request) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (
    s.rol === "PASTOR" ||
    s.rol === "LIDER_CONSOLIDADOR" ||
    s.rol === "SUPERADMIN"
  ) {
    return equipoDeIglesia(s, new URL(req.url).searchParams.get("iglesiaId"));
  }

  const yo = await db.usuario.findUnique({
    where: { id: s.sub },
    select: { redId: true, grupoId: true },
  });
  let miRed = yo?.redId ?? null;
  const miGrupo = yo?.grupoId ?? null;
  if (!miRed && miGrupo) {
    const g = await db.grupo.findUnique({
      where: { id: miGrupo },
      select: { redId: true },
    });
    miRed = g?.redId ?? null;
  }

  let iglesiaId: string | null = null;
  if (miRed) {
    const r = await db.red.findUnique({
      where: { id: miRed },
      select: { iglesiaId: true },
    });
    iglesiaId = r?.iglesiaId ?? null;
  } else if (s.iglesias.length > 0) {
    iglesiaId = s.iglesias[0];
  }
  if (!iglesiaId) return NextResponse.json({ equipo: null });

  const enIglesia = { iglesias: { some: { iglesiaId } } };

  async function uno(
    roles: Rol[],
    extra: { redId?: string; grupoId?: string },
    detalle: string
  ): Promise<Persona | null> {
    const u = await db.usuario.findFirst({
      where: { ...BASE, rol: { in: roles }, ...enIglesia, ...extra },
      select: { ...CORTO },
      orderBy: { nombre: "asc" },
    });
    return u ? { ...u, detalle } : null;
  }

  async function varios(
    roles: Rol[],
    extra: { redId?: string; grupoId?: string },
    detalle: string
  ): Promise<Persona[]> {
    const lista = await db.usuario.findMany({
      where: { ...BASE, rol: { in: roles }, ...enIglesia, ...extra },
      select: { ...CORTO },
      orderBy: { nombre: "asc" },
    });
    return lista.map((u) => ({ ...u, detalle }));
  }

  // Pastor y líder consolidador son de iglesia (sin red asignada): se buscan
  // en la iglesia, no por red. El líder de red/grupo se filtra por su red.
  const equipo: Record<string, unknown> = {
    pastor: await uno(["PASTOR"], {}, "Tu pastor"),
    liderConsolidador: await uno(
      ["LIDER_CONSOLIDADOR"],
      {},
      "Líder consolidador"
    ),
  };

  if (s.rol === "CONSOLIDADOR") {
    equipo.liderRed = miRed
      ? await uno(["LIDER_RED"], { redId: miRed }, "Tu líder de red")
      : null;
    let liderGrupo: Persona | null = null;
    if (miGrupo) {
      const lg = await db.usuario.findFirst({
        where: { ...BASE, rol: "LIDER_GRUPO", grupoId: miGrupo },
        select: { ...CORTO },
      });
      if (lg) {
        const g = await db.grupo.findUnique({
          where: { id: miGrupo },
          select: { nombre: true },
        });
        liderGrupo = { ...lg, detalle: g?.nombre ?? "Tu líder de grupo" };
      }
    }
    equipo.liderGrupo = liderGrupo;
  }

  if (s.rol === "LIDER_GRUPO" && miGrupo) {
    equipo.consolidadores = await varios(
      ["CONSOLIDADOR"],
      { grupoId: miGrupo },
      "Tu consolidador"
    );
    equipo.liderRed = miRed
      ? await uno(["LIDER_RED"], { redId: miRed }, "Tu líder de red")
      : null;
  }

  if (s.rol === "LIDER_RED" && miRed) {
    const grupos = await db.grupo.findMany({
      where: { redId: miRed, iglesiaId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });
    const detalle: Record<string, Persona[]> = {};
    for (const g of grupos) {
      detalle[g.id] = await varios(
        ["LIDER_GRUPO", "CONSOLIDADOR"],
        { grupoId: g.id },
        g.nombre
      );
    }
    equipo.grupos = grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      personas: detalle[g.id],
    }));
  }

  return NextResponse.json({ equipo });
}

/** Equipo de una iglesia para gestores y superadmin (solo lectura). */
async function equipoDeIglesia(
  s: NonNullable<Awaited<ReturnType<typeof leerSesion>>>,
  pedida: string | null
) {
  let iglesiaId: string | null = null;
  if (s.rol === "SUPERADMIN") {
    if (!pedida) return NextResponse.json({ equipo: null });
    const existe = await db.iglesia.findUnique({
      where: { id: pedida },
      select: { id: true, activo: true },
    });
    if (!existe || !existe.activo) return NextResponse.json({ equipo: null });
    iglesiaId = pedida;
  } else {
    const activas = await db.iglesia.findMany({
      where: { id: { in: s.iglesias }, activo: true },
      select: { id: true },
      orderBy: { nombre: "asc" },
    });
    const propias = activas.map((i) => i.id);
    if (propias.length === 0) return NextResponse.json({ equipo: null });
    iglesiaId = pedida && propias.includes(pedida) ? pedida : propias[0];
  }

  const enIglesia = { iglesias: { some: { iglesiaId } } };
  const iglesia = await db.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { id: true, nombre: true },
  });
  const pastor = await db.usuario.findFirst({
    where: { ...BASE, rol: "PASTOR", ...enIglesia },
    select: { ...CORTO },
    orderBy: { nombre: "asc" },
  });
  const lideres = await db.usuario.findMany({
    where: { ...BASE, rol: "LIDER_CONSOLIDADOR", ...enIglesia },
    select: { ...CORTO },
    orderBy: { nombre: "asc" },
  });
  const redes = await db.red.findMany({
    where: { iglesiaId, activo: true },
    select: { id: true, nombre: true, liderId: true },
    orderBy: { nombre: "asc" },
  });
  const lideresRed =
    redes.length > 0
      ? await db.usuario.findMany({
          where: { ...BASE, id: { in: redes.map((r) => r.liderId).filter((x): x is string => !!x) } },
          select: { ...CORTO },
        })
      : [];
  const porLiderRed = Object.fromEntries(lideresRed.map((u) => [u.id, u]));
  const grupos = await db.grupo.findMany({
    where: { iglesiaId, activo: true },
    select: { id: true, nombre: true, redId: true },
    orderBy: { nombre: "asc" },
  });
  const personas = await db.usuario.findMany({
    where: {
      ...BASE,
      rol: { in: ["LIDER_GRUPO", "CONSOLIDADOR"] },
      ...enIglesia,
    },
    select: { ...CORTO, grupoId: true },
    orderBy: { nombre: "asc" },
  });
  const etiqueta: Record<string, string> = {
    LIDER_GRUPO: "Líder de grupo",
    CONSOLIDADOR: "Consolidador",
  };
  const porGrupo: Record<string, Persona[]> = {};
  for (const g of grupos) porGrupo[g.id] = [];
  for (const p of personas) {
    if (p.grupoId && porGrupo[p.grupoId]) {
      porGrupo[p.grupoId].push({
        id: p.id,
        nombre: p.nombre,
        apellido: p.apellido,
        telefono: p.telefono,
        rol: p.rol,
        detalle: etiqueta[p.rol] ?? p.rol,
      });
    }
  }

  return NextResponse.json({
    equipo: {
      iglesia,
      pastor: pastor ? { ...pastor, detalle: "Pastor" } : null,
      lideresConsolidadores: lideres.map((u) => ({
        ...u,
        detalle: "Líder consolidador",
      })),
      redes: redes.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        lider:
          r.liderId && porLiderRed[r.liderId]
            ? { ...porLiderRed[r.liderId], detalle: "Líder de red" }
            : null,
        grupos: grupos
          .filter((g) => g.redId === r.id)
          .map((g) => ({ id: g.id, nombre: g.nombre, personas: porGrupo[g.id] })),
      })),
    },
  });
}
