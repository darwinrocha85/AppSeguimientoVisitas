import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { ROLES_QUE_CONSOLIDAN, esGestor } from "@/lib/alcance";
import { esSuperadmin } from "@/lib/permisos";

const ORDEN = [
  "DESEA_SER_CONTACTADO",
  "PRIMER_CONTACTO",
  "SEGUNDO_CONTACTO",
  "VISITA_AMISTAD",
] as const;

const Esquema = z.object({
  aEstado: z.enum(ORDEN).nullable().optional(),
  fechaContacto: z.string().min(1).nullable().optional(),
  observaciones: z.string().max(2000).nullable().optional(),
  // Marcar No contactar (líder consolidador y consolidador raso pueden):
  // cambia el flag sin tocar el estado.
  sinContacto: z.boolean().optional(),
});

/**
 * Reporte de avance del visitante (Fase 7 mínima): confirma 1er/2do
 * contacto o una visita de amistad con su fecha_contacto.
 * - Solo avance secuencial (sin saltos ni retrocesos); VISITA_AMISTAD
 *   admite N reportes (cada visita suma una entrada en el historial).
 * - Cada reporte crea una entrada en el historial (de/a, fecha_cambio,
 *   fecha_contacto, cambiado_por) y actualiza estadoActual.
 * - Permisos: pastor/líder consolidador (su iglesia), superadmin (todo)
 *   y quien tenga el visitante asignado (consolidador raso o líder de
 *   red/grupo que también consolida), solo en sus asignados.
 * - La fecha de contacto es obligatoria al avanzar.
 * - Bloqueo optimista por updatedAt: un doble envío no duplica el avance.
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
  const esAsignado =
    v.consolidadorId === s.sub &&
    (ROLES_QUE_CONSOLIDAN as readonly string[]).includes(s.rol);
  if (!esGest && !esSA && !esAsignado)
    return NextResponse.json(
      { error: "Solo tus visitantes asignados" },
      { status: 403 }
    );
  if (!esSA && !s.iglesias.includes(v.iglesiaId))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { aEstado, observaciones, sinContacto } = datos.data;
  if ((aEstado === null || aEstado === undefined) && sinContacto === undefined)
    return NextResponse.json({ error: "Nada que guardar" }, { status: 400 });

  const idxActual = ORDEN.indexOf(v.estadoActual as (typeof ORDEN)[number]);
  if (aEstado !== null && aEstado !== undefined) {
    const idxNuevo = ORDEN.indexOf(aEstado);
    const esRepeticionVisita =
      v.estadoActual === "VISITA_AMISTAD" && aEstado === "VISITA_AMISTAD";
    if (!esRepeticionVisita && idxNuevo !== idxActual + 1)
      return NextResponse.json(
        { error: "El reporte debe avanzar un paso (sin saltos ni retrocesos)" },
        { status: 400 }
      );
  }

  let fechaContacto: Date | null = null;
  if (aEstado && !datos.data.fechaContacto)
    return NextResponse.json(
      { error: "Indica la fecha del contacto" },
      { status: 400 }
    );
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

  // Solo se aplica si nadie tocó al visitante desde que se leyó: un doble
  // toque o dos personas a la vez no crean dos avances iguales.
  const aplicado = await db.$transaction(async (tx) => {
    const r = await tx.visitante.updateMany({
      where: { id, updatedAt: v.updatedAt },
      data: {
        ...(aEstado ? { estadoActual: aEstado } : {}),
        ...(sinContacto !== undefined ? { sinContacto } : {}),
      },
    });
    if (r.count === 0) return false;
    if (aEstado)
      await tx.visitanteHistorial.create({
        data: {
          visitanteId: id,
          deEstado: v.estadoActual,
          aEstado,
          fechaContacto,
          cambiadoPorId: s.sub,
          observaciones: observaciones || null,
        },
      });
    return true;
  });
  if (!aplicado)
    return NextResponse.json(
      { error: "El visitante acaba de cambiar. Recarga y revisa antes de reportar." },
      { status: 409 }
    );
  return NextResponse.json({ id, estado: aEstado ?? v.estadoActual });
}
