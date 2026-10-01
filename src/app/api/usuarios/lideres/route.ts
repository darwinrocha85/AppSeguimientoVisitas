import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { esGestor } from "@/lib/alcance";

/**
 * Candidatos a líder/raso dentro del alcance (para asignar red/grupo).
 * Solo gestores (pastor, líder consolidador) y superadmin.
 */
export async function GET(req: Request) {
  const s = await leerSesion();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!esGestor(s) && s.rol !== "SUPERADMIN")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const url = new URL(req.url);
  const rol = url.searchParams.get("rol");
  const iglesiaId = url.searchParams.get("iglesiaId");
  if (!["LIDER_RED", "LIDER_GRUPO", "CONSOLIDADOR"].includes(rol ?? "")) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }
  if (!iglesiaId)
    return NextResponse.json({ error: "Falta iglesia" }, { status: 400 });
  if (s.rol !== "SUPERADMIN" && !s.iglesias.includes(iglesiaId)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  const iglesia = await db.iglesia.findFirst({
    where: { id: iglesiaId, activo: true },
    select: { id: true },
  });
  if (!iglesia)
    return NextResponse.json({ error: "Iglesia inválida" }, { status: 400 });

  // Para liderar un grupo valen líderes de grupo y de red (de su red).
  const roles =
    rol === "LIDER_GRUPO" ? ["LIDER_RED", "LIDER_GRUPO"] : [rol as string];
  const lista = await db.usuario.findMany({
    where: {
      activo: true,
      rol: { in: roles as ("LIDER_RED" | "LIDER_GRUPO" | "CONSOLIDADOR")[] },
      iglesias: { some: { iglesiaId } },
    },
    select: { id: true, nombre: true, apellido: true, usuario: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(lista);
}
