import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import {
  filtroVisitantes,
  iglesiasDelAlcance,
  validarConsolidador,
  validarRedGrupo,
} from "@/lib/alcance";

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Estadísticas por RANGO usando fecha_cambio_estado (regla acordada):
 * un visitante cuenta UNA vez, en el estado de su ÚLTIMO cambio,
 * solo si ese cambio cae dentro de [inicio, fin].
 * Solo contactables: quien dijo No va a su tarjeta propia.
 * Supuesto documentado: el desglose por red/grupo usa la red y el grupo
 * ACTUALES del visitante (el historial no guarda red/grupo por cambio).
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
    // Las tarjetas de etapa cuentan contactables; quien dijo No va a su
    // tarjeta propia (conserva su estado como constancia) y no entra en
    // total ni % éxito.
    sinContacto: false,
    ...(rg.redId ? { redId: rg.redId } : {}),
    ...(rg.grupoId ? { grupoId: rg.grupoId } : {}),
    ...(conId ? { consolidadorId: conId } : {}),
  };

  const hist = await db.visitanteHistorial.findMany({
    where: { visitante: alcance },
    select: {
      visitanteId: true,
      deEstado: true,
      aEstado: true,
      fechaCambio: true,
      visitante: { select: { iglesiaId: true } },
    },
  });

  const ultimo = new Map<string, { estado: string; fecha: Date }>();
  const porVisitante = new Map<
    string,
    { iglesiaId: string; cambios: { de: string | null; fecha: Date }[] }
  >();
  for (const h of hist) {
    const p = ultimo.get(h.visitanteId);
    if (!p || h.fechaCambio > p.fecha) {
      ultimo.set(h.visitanteId, { estado: h.aEstado, fecha: h.fechaCambio });
    }
    let v = porVisitante.get(h.visitanteId);
    if (!v) {
      v = { iglesiaId: h.visitante.iglesiaId, cambios: [] };
      porVisitante.set(h.visitanteId, v);
    }
    v.cambios.push({ de: h.deEstado, fecha: h.fechaCambio });
  }
  const enRango = [...ultimo.entries()].filter(
    ([, v]) => v.fecha >= desde && v.fecha <= hasta
  );

  // ÉXITO: visitantes con ≥1 avance real (no solo creación) dentro del
  // rango Y dentro del límite de horas que el pastor fijó para ese estado
  // (AlertaConfig por iglesia; por defecto 100h). Por eso importa el histórico.
  const iglesiasTocadas = [...new Set([...porVisitante.values()].map((v) => v.iglesiaId))];
  const alertas = await db.alertaConfig.findMany({
    where: { iglesiaId: { in: iglesiasTocadas } },
  });
  const limiteHs = new Map(
    alertas.map((a) => [`${a.iglesiaId}|${a.estado}`, a.maxHoras])
  );
  const conAvance = new Set<string>();
  for (const [id, v] of porVisitante) {
    const ordenados = [...v.cambios].sort(
      (a, b) => a.fecha.getTime() - b.fecha.getTime()
    );
    for (let i = 1; i < ordenados.length; i++) {
      const actual = ordenados[i];
      const previo = ordenados[i - 1];
      if (!actual.de) continue; // creación, no avance
      if (actual.fecha < desde || actual.fecha > hasta) continue;
      const maxHs = limiteHs.get(`${v.iglesiaId}|${actual.de}`) ?? 100;
      const horas = (actual.fecha.getTime() - previo.fecha.getTime()) / 3600000;
      if (horas <= maxHs) {
        conAvance.add(id);
        break;
      }
    }
  }

  const porEstado: Record<string, number> = {
    DESEA_SER_CONTACTADO: 0,
    PRIMER_CONTACTO: 0,
    SEGUNDO_CONTACTO: 0,
    VISITA_AMISTAD: 0,
  };
  for (const [, v] of enRango) {
    porEstado[v.estado] = (porEstado[v.estado] ?? 0) + 1;
  }

  // Desglose por red/grupo actuales.
  const idsEnRango = enRango.map(([id]) => id);
  let porRed: { id: string; nombre: string; total: number }[] = [];
  let porGrupo: { id: string; nombre: string; total: number }[] = [];
  if (idsEnRango.length > 0) {
    const vs = await db.visitante.findMany({
      where: { id: { in: idsEnRango } },
      select: { id: true, redId: true, grupoId: true },
    });
    const cuentaRed = new Map<string, number>();
    const cuentaGrupo = new Map<string, number>();
    for (const v of vs) {
      if (v.redId) cuentaRed.set(v.redId, (cuentaRed.get(v.redId) ?? 0) + 1);
      if (v.grupoId)
        cuentaGrupo.set(v.grupoId, (cuentaGrupo.get(v.grupoId) ?? 0) + 1);
    }
    const [redes, grupos] = await Promise.all([
      [...cuentaRed.keys()].length > 0
        ? await db.red.findMany({
            where: { id: { in: [...cuentaRed.keys()] } },
            select: { id: true, nombre: true },
          })
        : [],
      [...cuentaGrupo.keys()].length > 0
        ? await db.grupo.findMany({
            where: { id: { in: [...cuentaGrupo.keys()] } },
            select: { id: true, nombre: true },
          })
        : [],
    ]);
    porRed = redes.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      total: cuentaRed.get(r.id) ?? 0,
    }));
    porGrupo = grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      total: cuentaGrupo.get(g.id) ?? 0,
    }));
  }

  const total = enRango.length;
  const consolidados = porEstado.VISITA_AMISTAD ?? 0;
  const enRangoIds = new Set(enRango.map(([id]) => id));
  const exito = [...conAvance].filter((id) => enRangoIds.has(id)).length;

  // Tarjeta "No contactar": último cambio en rango de quienes dijeron No
  // (conservan su etapa como constancia; no entran en total ni éxito).
  const histNo = await db.visitanteHistorial.findMany({
    where: { visitante: { ...alcance, sinContacto: true } },
    select: { visitanteId: true, fechaCambio: true },
  });
  const ultimoNo = new Map<string, Date>();
  for (const h of histNo) {
    const p = ultimoNo.get(h.visitanteId);
    if (!p || h.fechaCambio > p) ultimoNo.set(h.visitanteId, h.fechaCambio);
  }
  const noContactar = [...ultimoNo.values()].filter(
    (f) => f >= desde && f <= hasta
  ).length;

  return NextResponse.json({
    total,
    porEstado,
    porRed,
    porGrupo,
    noContactar,
    consolidados,
    conAvance: exito,
    exitoPct: total > 0 ? Math.round((exito / total) * 100) : 0,
  });
}
