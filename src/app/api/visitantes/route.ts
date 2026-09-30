import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import {
  ASIGNADO,
  SIN_ASIGNAR,
  esGestor,
  filtroVisitantes,
  iglesiasDelAlcance,
  validarConsolidador,
  validarRedGrupo,
  veNoAsignados,
} from "@/lib/alcance";
import { TELEFONO_AYUDA, TELEFONO_REGEX } from "@/lib/telefono";

/** Lista de visitantes del alcance del usuario (con filtros en cascada). */
export async function GET(req: Request) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const iglesiaId =
    s.rol === "SUPERADMIN" ? url.searchParams.get("iglesiaId") : null;

  const base = (await filtroVisitantes(s, iglesiaId)) as Record<
    string,
    unknown
  >;
  const ids = await iglesiasDelAlcance(s, iglesiaId);
  // Tab de no asignados (solo iglesia): únicamente pastor, líder
  // consolidador y superadmin. Ignora filtros de red/grupo/consolidador.
  const sinAsignar = url.searchParams.get("sinAsignar") === "1";
  if (sinAsignar && !veNoAsignados(s)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  const alcance: Record<string, unknown> = sinAsignar
    ? { ...base, activo: true, ...SIN_ASIGNAR }
    : { ...base, activo: true, ...ASIGNADO };
  if (!sinAsignar) {
    const rg = await validarRedGrupo(
      s,
      ids,
      url.searchParams.get("redId"),
      url.searchParams.get("grupoId")
    );
    if (rg.redId) alcance.redId = rg.redId;
    if (rg.grupoId) alcance.grupoId = rg.grupoId;
    const conId = await validarConsolidador(
      s,
      ids,
      rg.grupoId,
      url.searchParams.get("consolidadorId")
    );
    if (conId) alcance.consolidadorId = conId;
  }

  const listaBase = await db.visitante.findMany({
    where: alcance,
    include: {
      origen: { select: { nombre: true } },
      consolidador: { select: { nombre: true, apellido: true } },
      iglesia: { select: { nombre: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // SQLite compara texto con mayúsculas/acentos estrictos: filtramos aquí
  // sin distinguir mayúsculas ni acentos (nombres en español).
  const normaliza = (t: string) =>
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9 ]/g, "");
  const qn = normaliza(q);
  const lista = qn
    ? listaBase.filter((v) =>
        normaliza(
          `${v.nombre} ${v.apellido} ${v.telefono ?? ""}`
        ).includes(qn)
      )
    : listaBase;

  const redIds = [...new Set(lista.map((v) => v.redId).filter(Boolean))];
  const grupoIds = [...new Set(lista.map((v) => v.grupoId).filter(Boolean))];
  const [redes, grupos, cambios] = await Promise.all([
    redIds.length > 0
      ? await db.red.findMany({ where: { id: { in: redIds as string[] } } })
      : [],
    grupoIds.length > 0
      ? await db.grupo.findMany({
          where: { id: { in: grupoIds as string[] } },
        })
      : [],
    lista.length > 0
      ? await db.visitanteHistorial.groupBy({
          by: ["visitanteId"],
          where: { visitanteId: { in: lista.map((v) => v.id) } },
          _max: { fechaCambio: true },
        })
      : [],
  ]);
  const nombreRed = Object.fromEntries(redes.map((r) => [r.id, r.nombre]));
  const nombreGrupo = Object.fromEntries(grupos.map((g) => [g.id, g.nombre]));
  const ultimoCambio = Object.fromEntries(
    cambios.map((c) => [c.visitanteId, c._max.fechaCambio])
  );

  return NextResponse.json(
    lista.map((v) => ({
      id: v.id,
      nombre: v.nombre,
      apellido: v.apellido,
      telefono: v.telefono,
      zona: v.zona,
      edad: v.edad,
      codigoPostal: v.codigoPostal,
      calle: v.calle,
      invitadoPor: v.invitadoPor,
      peticiones: v.peticiones,
      observaciones: v.observaciones,
      estadoActual: v.estadoActual,
      origen: v.origen?.nombre ?? null,
      origenId: v.origenId ?? null,
      iglesiaId: v.iglesiaId,
      iglesia: v.iglesia.nombre,
      redId: v.redId,
      grupoId: v.grupoId,
      red: v.redId ? (nombreRed[v.redId] ?? null) : null,
      grupo: v.grupoId ? (nombreGrupo[v.grupoId] ?? null) : null,
      consolidadorId: v.consolidadorId,
      consolidador: v.consolidador
        ? `${v.consolidador.nombre} ${v.consolidador.apellido}`
        : null,
      fechaRegistro: v.createdAt,
      ultimoCambio: ultimoCambio[v.id] ?? v.createdAt,
    }))
  );
}

const EsquemaCrear = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  zona: z.string().min(1),
  telefono: z.string().regex(TELEFONO_REGEX, TELEFONO_AYUDA).nullable().optional(),
  edad: z.number().int().min(0).max(120).nullable().optional(),
  codigoPostal: z.string().nullable().optional(),
  calle: z.string().nullable().optional(),
  invitadoPor: z.string().nullable().optional(),
  peticiones: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  origenId: z.string().nullable().optional(),
  iglesiaId: z.string().min(1),
  redId: z.string().nullable().optional(),
  grupoId: z.string().nullable().optional(),
  consolidadorId: z.string().nullable().optional(),
});

async function validarUbicacion(
  s: { iglesias: string[] },
  iglesiaId: string,
  redId?: string | null,
  grupoId?: string | null
) {
  if (!s.iglesias.includes(iglesiaId)) return "Iglesia fuera de tu alcance";
  const iglesia = await db.iglesia.findFirst({
    where: { id: iglesiaId, activo: true },
    select: { id: true },
  });
  if (!iglesia) return "Iglesia inválida";
  if (redId) {
    const r = await db.red.findFirst({
      where: { id: redId, iglesiaId, activo: true },
      select: { id: true },
    });
    if (!r) return "Red inválida";
  }
  if (grupoId) {
    const g = await db.grupo.findFirst({
      where: {
        id: grupoId,
        iglesiaId,
        activo: true,
        ...(redId ? { redId } : {}),
      },
      select: { id: true },
    });
    if (!g) return "Grupo inválido";
  }
  return null;
}

export async function POST(req: Request) {
  const s = await leerSesion();
  if (!esGestor(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const datos = EsquemaCrear.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json(
      { error: "Datos inválidos", detalle: datos.error.flatten() },
      { status: 400 }
    );
  const d = datos.data;

  const mal = await validarUbicacion(s!, d.iglesiaId, d.redId, d.grupoId);
  if (mal) return NextResponse.json({ error: mal }, { status: 400 });

  if (d.origenId) {
    const o = await db.origen.findFirst({
      where: {
        id: d.origenId,
        activo: true,
        OR: [{ iglesiaId: null }, { iglesiaId: d.iglesiaId }],
      },
      select: { id: true },
    });
    if (!o) return NextResponse.json({ error: "Origen inválido" }, { status: 400 });
  }
  if (d.consolidadorId) {
    const c = await db.usuario.findFirst({
      where: {
        id: d.consolidadorId,
        activo: true,
        rol: "CONSOLIDADOR",
        iglesias: { some: { iglesiaId: d.iglesiaId } },
        ...(d.grupoId ? { grupoId: d.grupoId } : {}),
      },
      select: { id: true },
    });
    if (!c)
      return NextResponse.json({ error: "Consolidador inválido" }, { status: 400 });
  }

  const creado = await db.visitante.create({
    data: {
      nombre: d.nombre,
      apellido: d.apellido,
      zona: d.zona,
      telefono: d.telefono ?? null,
      edad: d.edad ?? null,
      codigoPostal: d.codigoPostal ?? null,
      calle: d.calle ?? null,
      invitadoPor: d.invitadoPor ?? null,
      peticiones: d.peticiones ?? null,
      observaciones: d.observaciones ?? null,
      origenId: d.origenId ?? null,
      iglesiaId: d.iglesiaId,
      redId: d.redId ?? null,
      grupoId: d.grupoId ?? null,
      consolidadorId: d.consolidadorId ?? null,
      estadoActual: "DESEA_SER_CONTACTADO",
      historial: {
        create: {
          deEstado: null,
          aEstado: "DESEA_SER_CONTACTADO",
          cambiadoPorId: s!.sub,
        },
      },
    },
  });
  return NextResponse.json({ id: creado.id }, { status: 201 });
}
