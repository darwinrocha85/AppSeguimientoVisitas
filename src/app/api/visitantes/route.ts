import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import {
  ASIGNADO,
  NECESITA_ASIGNACION,
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
  // La iglesia elegida aplica para superadmin y gestores (pastor/líder);
  // el alcance la intersecta con las propias (máx 2).
  const iglesiaId =
    s.rol === "SUPERADMIN" ||
    s.rol === "PASTOR" ||
    s.rol === "LIDER_CONSOLIDADOR"
      ? url.searchParams.get("iglesiaId")
      : null;

  const base = (await filtroVisitantes(s, iglesiaId)) as Record<
    string,
    unknown
  >;
  const ids = await iglesiasDelAlcance(s, iglesiaId);
  // Bandeja única "No asignados" (pastor, líder consolidador y
  // superadmin; ignora filtros de red/grupo/consolidador): solo iglesia
  // (sin red, grupo ni consolidador) MÁS 1er contacto sin consolidador
  // para el 2do (derivado, sigue contando como PRIMER_CONTACTO).
  const sinAsignar = url.searchParams.get("sinAsignar") === "1";
  if (sinAsignar && !veNoAsignados(s)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  // Tab Sin contacto (gestores): quienes dijeron No a WhatsApp.
  const soloSin = url.searchParams.get("sinContacto") === "1";
  if (soloSin && !veNoAsignados(s)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  const alcance: Record<string, unknown> = sinAsignar
    ? { ...base, activo: true, ...NECESITA_ASIGNACION }
    : soloSin
      ? { ...base, activo: true, sinContacto: true }
      : { ...base, activo: true, ...ASIGNADO };
  // Tab Todos (gestores): incluye asignados y no asignados. Los no
  // asignados van con alcance de iglesia (ignoran red/grupo/consolidador,
  // como su tab) y nunca fuera del permiso de verlos.
  const todos =
    !sinAsignar &&
    !soloSin &&
    url.searchParams.get("todos") === "1" &&
    veNoAsignados(s);
  if (!sinAsignar && !soloSin) {
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
    orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
    take: 200,
  });
  // Unión con no asignados (evita duplicados: 1er contacto con red pero
  // sin consolidador sale en ambas).
  let listaJunta = listaBase;
  if (todos) {
    const sin = await db.visitante.findMany({
      where: { ...base, activo: true, ...NECESITA_ASIGNACION },
      include: {
        origen: { select: { nombre: true } },
        consolidador: { select: { nombre: true, apellido: true } },
        iglesia: { select: { nombre: true } },
      },
      orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
      take: 200,
    });
    const vistos = new Set(listaBase.map((v) => v.id));
    listaJunta = [
      ...listaBase,
      ...sin.filter((v) => !vistos.has(v.id)),
    ];
  }
  // Orden alfabético estable en español (SQLite ordena por bytes y
  // descuadra acentos/mayúsculas): así editar o guardar no mueve a nadie.
  listaJunta = [...listaJunta]
    .sort((a, b) =>
      `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, "es", {
        sensitivity: "base",
      })
    )
    .slice(0, 100);

  // SQLite compara texto con mayúsculas/acentos estrictos: filtramos aquí
  // sin distinguir mayúsculas ni acentos (nombres en español).
  const normaliza = (t: string) =>
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9 ]/g, "");
  const qn = normaliza(q);
  const lista = qn
    ? listaJunta.filter((v) =>
        normaliza(
          `${v.nombre} ${v.apellido} ${v.telefono ?? ""}`
        ).includes(qn)
      )
    : listaJunta;

  const redIds = [...new Set(lista.map((v) => v.redId).filter(Boolean))];
  const grupoIds = [...new Set(lista.map((v) => v.grupoId).filter(Boolean))];
  const [redes, grupos, cambios, reporte] = await Promise.all([
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
    // Historial para el detalle (últimos reportes con fecha de contacto).
    lista.length > 0
      ? await db.visitanteHistorial.findMany({
          where: { visitanteId: { in: lista.map((v) => v.id) } },
          select: {
            visitanteId: true,
            deEstado: true,
            aEstado: true,
            fechaCambio: true,
            fechaContacto: true,
            observaciones: true,
          },
          orderBy: { fechaCambio: "desc" },
          take: 400,
        })
      : [],
  ]);
  const porHistorial = new Map<string, typeof reporte>();
  for (const h of reporte) {
    const l = porHistorial.get(h.visitanteId) ?? [];
    if (l.length < 10) l.push(h);
    porHistorial.set(h.visitanteId, l);
  }
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
      sinContacto: v.sinContacto,
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
      historial: porHistorial.get(v.id) ?? [],
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
  sinContacto: z.boolean().optional(),
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
        rol: { in: ["CONSOLIDADOR", "LIDER_RED", "LIDER_GRUPO", "LIDER_CONSOLIDADOR"] },
        iglesias: { some: { iglesiaId: d.iglesiaId } },
      },
      select: { id: true, grupoId: true, redId: true },
    });
    // Nivel iglesia (sin red/grupo, p. ej. líder consolidador) puede
    // consolidar cualquier grupo de su iglesia; con red/grupo fijados,
    // deben coincidir con los del visitante.
    if (!c || (c.grupoId && d.grupoId && c.grupoId !== d.grupoId) || (c.redId && d.redId && c.redId !== d.redId))
      return NextResponse.json({ error: "Consolidador inválido" }, { status: 400 });
  }

  // El teléfono identifica a la persona: no se guarda dos veces
  // (global, entre activos; sin teléfono se permite).
  if (d.telefono) {
    const tel = d.telefono.replace(/\D/g, "");
    const dup = await db.visitante.findFirst({
      where: { telefono: tel, activo: true },
      select: { id: true, nombre: true, apellido: true },
    });
    if (dup)
      return NextResponse.json(
        { error: `Ya existe ${dup.nombre} ${dup.apellido} con ese teléfono` },
        { status: 409 }
      );
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
      sinContacto: d.sinContacto ?? false,
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
