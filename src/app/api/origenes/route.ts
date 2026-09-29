import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";

/** Orígenes (canal de captación): globales + de las iglesias del alcance. */
export async function GET() {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const lista = await db.origen.findMany({
    where: {
      activo: true,
      OR: [
        { iglesiaId: null },
        s.rol === "SUPERADMIN"
          ? { iglesiaId: { not: null } }
          : { iglesiaId: { in: s.iglesias } },
      ],
    },
    select: { id: true, nombre: true, iglesiaId: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(lista);
}
