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
 * Nunca incluye afiliaciones a otras iglesias: solo personas y nombres
 * del alcance actual.
 */
export async function GET() {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (
    s.rol !== "CONSOLIDADOR" &&
    s.rol !== "LIDER_GRUPO" &&
    s.rol !== "LIDER_RED"
  ) {
    return NextResponse.json({ equipo: null });
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

  const filtroRed = s.rol === "LIDER_GRUPO" || s.rol === "LIDER_RED" ? { redId: miRed ?? undefined } : {};
  const equipo: Record<string, unknown> = {
    pastor: await uno(["PASTOR"], filtroRed, "Tu pastor"),
    liderConsolidador: await uno(
      ["LIDER_CONSOLIDADOR"],
      filtroRed,
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
