import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import {
  ASIGNADO,
  filtroVisitantes,
  iglesiasDelAlcance,
  validarConsolidador,
  validarRedGrupo,
} from "@/lib/alcance";

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = [
  "DESEA_SER_CONTACTADO",
  "PRIMER_CONTACTO",
  "SEGUNDO_CONTACTO",
  "VISITA_AMISTAD",
];

function aISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Evolución en el tiempo: avances reales (cambios de estado, sin contar
 * la creación) agrupados por cubeta (día/semana/mes) dentro del rango,
 * con el mismo alcance por rol que el resto del tablero.
 */
export async function GET(req: Request) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const inicioStr = url.searchParams.get("inicio") ?? "";
  const finStr = url.searchParams.get("fin") ?? "";
  if (!SOLO_FECHA.test(inicioStr) || !SOLO_FECHA.test(finStr)) {
    return NextResponse.json(
      { error: "Rango inválido (AAAA-MM-DD)" },
      { status: 400 }
    );
  }
  const desde = new Date(`${inicioStr}T00:00:00`);
  const hasta = new Date(`${finStr}T23:59:59.999`);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || hasta < desde) {
    return NextResponse.json({ error: "Rango inválido" }, { status: 400 });
  }

  // La iglesia elegida aplica para superadmin y gestores (pastor/líder);
  // el alcance la intersecta con las propias (máx 2).
  const iglesiaId =
    s.rol === "SUPERADMIN" ||
    s.rol === "PASTOR" ||
    s.rol === "LIDER_CONSOLIDADOR"
      ? url.searchParams.get("iglesiaId")
      : null;
  const ids = await iglesiasDelAlcance(s, iglesiaId);
  const rg = await validarRedGrupo(
    s,
    ids,
    url.searchParams.get("redId"),
    url.searchParams.get("grupoId")
  );
  const base = (await filtroVisitantes(s, iglesiaId)) as Record<
    string,
    unknown
  >;
  const conId = await validarConsolidador(
    s,
    ids,
    rg.grupoId,
    url.searchParams.get("consolidadorId")
  );
  const alcance: Record<string, unknown> = {
    ...base,
    activo: true,
    ...ASIGNADO,
    ...(rg.redId ? { redId: rg.redId } : {}),
    ...(rg.grupoId ? { grupoId: rg.grupoId } : {}),
    ...(conId ? { consolidadorId: conId } : {}),
  };

  // Cubeta según amplitud: día (≤40), semana (≤180), mes (>180).
  const dias = Math.ceil((hasta.getTime() - desde.getTime()) / 86400000) + 1;
  const por: "dia" | "semana" | "mes" =
    dias <= 40 ? "dia" : dias <= 180 ? "semana" : "mes";

  function cubeta(fecha: Date): string {
    if (por === "dia") return aISO(fecha);
    if (por === "mes")
      return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-01`;
    const dow = (fecha.getDay() + 6) % 7;
    const lunes = new Date(fecha);
    lunes.setDate(fecha.getDate() - dow);
    return aISO(lunes);
  }

  // Todas las cubetas del rango (aunque queden en cero).
  const claves: string[] = [];
  if (por === "dia") {
    for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
      claves.push(aISO(d));
    }
  } else if (por === "semana") {
    const dow = (desde.getDay() + 6) % 7;
    const lunes = new Date(desde);
    lunes.setDate(desde.getDate() - dow);
    for (let d = lunes; d <= hasta; d.setDate(d.getDate() + 7)) {
      claves.push(aISO(d));
    }
  } else {
    const ini = new Date(desde.getFullYear(), desde.getMonth(), 1);
    for (let d = ini; d <= hasta; d.setMonth(d.getMonth() + 1)) {
      claves.push(aISO(d));
    }
  }

  const hist = await db.visitanteHistorial.findMany({
    where: {
      visitante: alcance,
      deEstado: { not: null },
      fechaCambio: { gte: desde, lte: hasta },
    },
    select: { aEstado: true, fechaCambio: true },
  });

  const datos = new Map(
    claves.map((c) => [
      c,
      {
        clave: c,
        total: 0,
        porEstado: Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<
          string,
          number
        >,
      },
    ])
  );
  for (const h of hist) {
    const c = cubeta(h.fechaCambio);
    const b = datos.get(c);
    if (!b) continue;
    b.total += 1;
    b.porEstado[h.aEstado] = (b.porEstado[h.aEstado] ?? 0) + 1;
  }

  // Solo cubetas con movimiento: el eje muestra únicamente fechas
  // donde hubo cambios de estado (sin saltos de días vacíos).
  const puntos = [...datos.values()].filter((b) => b.total > 0);
  return NextResponse.json({ por, puntos });
}
