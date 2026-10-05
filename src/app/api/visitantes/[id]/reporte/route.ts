import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esGestor } from "@/lib/alcance";
import { esSuperadmin } from "@/lib/permisos";

const ORDEN = [
  "DESEA_SER_CONTACTADO",
  "PRIMER_CONTACTO",
  "SEGUNDO_CONTACTO",
  "VISITA_AMISTAD",
] as const;

const Esquema = z.object({
  aEstado: z.enum(ORDEN),
  fechaContacto: z.string().min(1).nullable().optional(),
  observaciones: z.string().max(2000).nullable().optional(),
});

/**
 * Reporte de avance del visitante (Fase 7 mínima): confirma 1er/2do
 * contacto o una visita de amistad con su fecha_contacto.
 * - Solo avance secuencial (sin saltos ni retrocesos); VISITA_AMISTAD
 *   admite N reportes (cada visita suma una entrada en el historial).
 * - Cada reporte crea una entrada en el historial (de/a, fecha_cambio,
 *   fecha_contacto, cambiado_por) y actualiza estadoActual.
 * - Permisos: pastor/líder consolidador (su iglesia), superadmin (todo)
 *   y consolidador (solo sus asignados). Líderes de red/grupo: lectura.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const v = await db.visitante.findUnique({ where: { id } });
  if (!v || !v.activo)
    return NextResponse.json({ error: "No existe" }, { status: 404 });

  const esGest = esGestor(s);
  const esSA = esSuperadmin(s);
  const esRaso = s.rol === "CONSOLIDADOR";
  if (!esGest && !esSA && !esRaso)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  if (!esSA && !s.iglesias.includes(v.iglesiaId))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  if (esRaso && v.consolidadorId !== s.sub)
    return NextResponse.json(
      { error: "Solo tus visitantes asignados" },
      { status: 403 }
    );

  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { aEstado, observaciones } = datos.data;

  const idxActual = ORDEN.indexOf(v.estadoActual as (typeof ORDEN)[number]);
  const idxNuevo = ORDEN.indexOf(aEstado);
  const esRepeticionVisita =
    v.estadoActual === "VISITA_AMISTAD" && aEstado === "VISITA_AMISTAD";
  if (!esRepeticionVisita && idxNuevo !== idxActual + 1)
    return NextResponse.json(
      { error: "El reporte debe avanzar un paso (sin saltos ni retrocesos)" },
      { status: 400 }
    );

  let fechaContacto: Date | null = null;
  if (datos.data.fechaContacto) {
    const f = new Date(datos.data.fechaContacto);
    if (Number.isNaN(f.getTime()))
      return NextResponse.json(
        { error: "Fecha de contacto inválida" },
        { status: 400 }
      );
    if (f.getTime() > Date.now() + 24 * 3600 * 1000)
      return NextResponse.json(
        { error: "La fecha no puede ser futura" },
        { status: 400 }
      );
    fechaContacto = f;
  }

  const [actualizado] = await db.$transaction([
    db.visitante.update({
      where: { id },
      data: { estadoActual: aEstado },
    }),
    db.visitanteHistorial.create({
      data: {
        visitanteId: id,
        deEstado: v.estadoActual,
        aEstado,
        fechaContacto,
        cambiadoPorId: s.sub,
        observaciones: observaciones || null,
      },
    }),
  ]);
  return NextResponse.json({ id: actualizado.id, estado: actualizado.estadoActual });
}
