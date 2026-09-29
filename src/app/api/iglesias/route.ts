import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esSuperadmin } from "@/lib/permisos";
import { TELEFONO_AYUDA, TELEFONO_REGEX } from "@/lib/telefono";

const Esquema = z.object({
  nombre: z.string().min(1),
  direccion: z.string().optional(),
  telefono: z.string().regex(TELEFONO_REGEX, TELEFONO_AYUDA).optional(),
});

export async function GET() {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  // Superadmin ve todo; otros roles solo sus iglesias (sin revelar afiliaciones del pastor a otras iglesias: se filtra por alcance propio).
  const iglesias =
    s.rol === "SUPERADMIN"
      ? await db.iglesia.findMany({
          where: { activo: true },
          orderBy: { nombre: "asc" },
        })
      : await db.iglesia.findMany({
          where: { id: { in: s.iglesias }, activo: true },
          orderBy: { nombre: "asc" },
        });
  return NextResponse.json(iglesias);
}

export async function POST(req: Request) {
  const s = await leerSesion();
  if (!esSuperadmin(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const iglesia = await db.iglesia.create({
    data: {
      nombre: datos.data.nombre,
      direccion: datos.data.direccion,
      telefono: datos.data.telefono,
      // Alerta configurable por defecto 100h por estado; solo el pastor la ajusta después.
      alertas: {
        create: [
          { estado: "DESEA_SER_CONTACTADO", maxHoras: 100 },
          { estado: "PRIMER_CONTACTO", maxHoras: 100 },
          { estado: "SEGUNDO_CONTACTO", maxHoras: 100 },
          { estado: "VISITA_AMISTAD", maxHoras: 100 },
        ],
      },
    },
  });
  return NextResponse.json(iglesia, { status: 201 });
}
