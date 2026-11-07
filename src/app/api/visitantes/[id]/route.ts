import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esGestor } from "@/lib/alcance";
import { TELEFONO_AYUDA, TELEFONO_REGEX } from "@/lib/telefono";

const Esquema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  zona: z.string().min(1).optional(),
  telefono: z.string().regex(TELEFONO_REGEX, TELEFONO_AYUDA).nullable().optional(),
  edad: z.number().int().min(0).max(120).nullable().optional(),
  codigoPostal: z.string().nullable().optional(),
  calle: z.string().nullable().optional(),
  invitadoPor: z.string().nullable().optional(),
  peticiones: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  origenId: z.string().nullable().optional(),
  iglesiaId: z.string().min(1).optional(),
  redId: z.string().nullable().optional(),
  grupoId: z.string().nullable().optional(),
  consolidadorId: z.string().nullable().optional(),
  sinContacto: z.boolean().optional(),
});

async function enAlcance(
  s: { iglesias: string[] },
  visitanteId: string
) {
  const v = await db.visitante.findUnique({ where: { id: visitanteId } });
  if (!v || !v.activo) return null;
  if (!s.iglesias.includes(v.iglesiaId)) return null;
  return v;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await leerSesion();
  if (!esGestor(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { id } = await params;
  const actual = await enAlcance(s!, id);
  if (!actual)
    return NextResponse.json({ error: "No existe" }, { status: 404 });

  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const d = datos.data;
  // El estado NO se cambia aquí (eso es el reporte con fecha_contacto).
  const iglesiaId = d.iglesiaId ?? actual.iglesiaId;
  if (!s!.iglesias.includes(iglesiaId))
    return NextResponse.json({ error: "Iglesia fuera de tu alcance" }, { status: 400 });

  const redId = d.redId !== undefined ? d.redId : actual.redId;
  const grupoId = d.grupoId !== undefined ? d.grupoId : actual.grupoId;
  if (redId) {
    const r = await db.red.findFirst({
      where: { id: redId, iglesiaId, activo: true },
      select: { id: true },
    });
    if (!r) return NextResponse.json({ error: "Red inválida" }, { status: 400 });
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
    if (!g) return NextResponse.json({ error: "Grupo inválido" }, { status: 400 });
  }
  if (d.origenId) {
    const o = await db.origen.findFirst({
      where: {
        id: d.origenId,
        activo: true,
        OR: [{ iglesiaId: null }, { iglesiaId }],
      },
      select: { id: true },
    });
    if (!o)
      return NextResponse.json({ error: "Origen inválido" }, { status: 400 });
  }
  // Un consolidador encaja si está activo, consolida, es de la iglesia y su
  // red/grupo (si los tiene) coinciden con los del visitante. El líder de
  // red encaja en cualquier grupo de su red (aunque también lidere uno).
  async function encaja(consolidadorId: string) {
    const c = await db.usuario.findFirst({
      where: {
        id: consolidadorId,
        activo: true,
        rol: { in: ["CONSOLIDADOR", "LIDER_RED", "LIDER_GRUPO", "LIDER_CONSOLIDADOR"] },
        iglesias: { some: { iglesiaId } },
      },
      select: { id: true, rol: true, grupoId: true, redId: true },
    });
    if (!c) return false;
    if (c.redId && redId && c.redId !== redId) return false;
    if (c.rol !== "LIDER_RED" && c.grupoId && grupoId && c.grupoId !== grupoId)
      return false;
    return true;
  }
  if (d.consolidadorId && !(await encaja(d.consolidadorId)))
    return NextResponse.json({ error: "Consolidador inválido" }, { status: 400 });

  // Cambio de grupo sin elegir consolidador: lo toma el líder de la red del
  // nuevo grupo (si está activo y es de la iglesia). Si se elige uno a mano,
  // se respeta.
  const cambiaGrupo = !!grupoId && grupoId !== actual.grupoId;
  let consolidadorAuto: string | null | undefined = undefined;
  if (cambiaGrupo && !d.consolidadorId) {
    const g = await db.grupo.findUnique({
      where: { id: grupoId },
      select: { red: { select: { liderId: true } } },
    });
    const liderId = g?.red.liderId;
    const lider = liderId
      ? await db.usuario.findFirst({
          where: {
            id: liderId,
            activo: true,
            rol: "LIDER_RED",
            iglesias: { some: { iglesiaId } },
          },
          select: { id: true },
        })
      : null;
    consolidadorAuto = lider?.id ?? null;
  }

  // Si cambia iglesia/red/grupo sin indicar consolidador (y no hubo líder
  // automático), el actual se revalida: si ya no encaja se quita (vuelve a
  // No asignados) en lugar de dejarlo asignado a alguien de otro grupo.
  const cambiaUbicacion =
    iglesiaId !== actual.iglesiaId ||
    redId !== actual.redId ||
    grupoId !== actual.grupoId;
  const quitaConsolidador =
    consolidadorAuto === undefined &&
    d.consolidadorId === undefined &&
    cambiaUbicacion &&
    !!actual.consolidadorId &&
    !(await encaja(actual.consolidadorId));

  // El teléfono identifica a la persona: no se guarda dos veces
  // (global, entre activos; sin teléfono se permite).
  if (d.telefono) {
    const tel = d.telefono.replace(/\D/g, "");
    if (tel !== (actual.telefono ?? "")) {
      const dup = await db.visitante.findFirst({
        where: { telefono: tel, activo: true, NOT: { id } },
        select: { id: true, nombre: true, apellido: true },
      });
      if (dup)
        return NextResponse.json(
          { error: `Ya existe ${dup.nombre} ${dup.apellido} con ese teléfono` },
          { status: 409 }
        );
    }
  }

  const actualizado = await db.visitante.update({
    where: { id },
    data: {
      ...(d.nombre ? { nombre: d.nombre } : {}),
      ...(d.apellido ? { apellido: d.apellido } : {}),
      ...(d.zona ? { zona: d.zona } : {}),
      ...(d.telefono !== undefined ? { telefono: d.telefono } : {}),
      ...(d.edad !== undefined ? { edad: d.edad } : {}),
      ...(d.codigoPostal !== undefined ? { codigoPostal: d.codigoPostal } : {}),
      ...(d.calle !== undefined ? { calle: d.calle } : {}),
      ...(d.invitadoPor !== undefined ? { invitadoPor: d.invitadoPor } : {}),
      ...(d.peticiones !== undefined ? { peticiones: d.peticiones } : {}),
      ...(d.observaciones !== undefined ? { observaciones: d.observaciones } : {}),
      ...(d.origenId !== undefined ? { origenId: d.origenId } : {}),
      ...(d.iglesiaId ? { iglesiaId: d.iglesiaId } : {}),
      ...(d.redId !== undefined ? { redId: d.redId } : {}),
      ...(d.grupoId !== undefined ? { grupoId: d.grupoId } : {}),
      ...(consolidadorAuto !== undefined
        ? { consolidadorId: consolidadorAuto }
        : d.consolidadorId !== undefined
        ? { consolidadorId: d.consolidadorId }
        : quitaConsolidador
          ? { consolidadorId: null }
          : {}),
      ...(d.sinContacto !== undefined ? { sinContacto: d.sinContacto } : {}),
    },
  });
  return NextResponse.json({ id: actualizado.id });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await leerSesion();
  if (!esGestor(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const { id } = await params;
  const actual = await enAlcance(s!, id);
  if (!actual)
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  await db.visitante.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
