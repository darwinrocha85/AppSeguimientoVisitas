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
  if (d.consolidadorId) {
    const c = await db.usuario.findFirst({
      where: {
        id: d.consolidadorId,
        activo: true,
        rol: "CONSOLIDADOR",
        iglesias: { some: { iglesiaId } },
        ...(grupoId ? { grupoId } : {}),
      },
      select: { id: true },
    });
    if (!c)
      return NextResponse.json({ error: "Consolidador inválido" }, { status: 400 });
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
      ...(d.consolidadorId !== undefined
        ? { consolidadorId: d.consolidadorId }
        : {}),
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
