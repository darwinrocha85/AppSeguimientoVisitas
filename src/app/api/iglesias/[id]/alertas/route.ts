import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esSuperadmin } from "@/lib/permisos";

const Esquema = z.object({
  estado: z.enum([
    "DESEA_SER_CONTACTADO",
    "PRIMER_CONTACTO",
    "SEGUNDO_CONTACTO",
    "VISITA_AMISTAD",
  ]),
  maxHoras: z.number().int().min(1).max(24 * 90),
});

/**
 * Límites de alerta por transición (horas que el pastor fija para pasar
 * de un estado al siguiente). Solo el pastor de la iglesia (y superadmin).
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const permitida =
    esSuperadmin(s) ||
    (s.rol === "PASTOR" && s.iglesias.includes(id));
  if (!permitida)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const iglesia = await db.iglesia.findFirst({
    where: { id, activo: true },
    select: { id: true },
  });
  if (!iglesia)
    return NextResponse.json({ error: "No existe" }, { status: 404 });

  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const alerta = await db.alertaConfig.upsert({
    where: { iglesiaId_estado: { iglesiaId: id, estado: datos.data.estado } },
    update: { maxHoras: datos.data.maxHoras },
    create: {
      iglesiaId: id,
      estado: datos.data.estado,
      maxHoras: datos.data.maxHoras,
    },
  });
  return NextResponse.json(alerta);
}
