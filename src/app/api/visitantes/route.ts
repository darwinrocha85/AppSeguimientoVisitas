import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leerSesion } from "@/lib/auth";
import { filtroVisitantes, iglesiasDelAlcance, validarConsolidador, validarRedGrupo } from "@/lib/alcance";

/** Lista de visitantes del alcance del usuario (solo lectura por ahora). */
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
  // Cascada red→grupo validada contra el alcance (nunca lo amplía).
  const ids = await iglesiasDelAlcance(s, iglesiaId);
  const rg = await validarRedGrupo(
    s,
    ids,
    url.searchParams.get("redId"),
    url.searchParams.get("grupoId")
  );
  const alcance: Record<string, unknown> = {
    ...base,
    activo: true,
    ...(rg.redId ? { redId: rg.redId } : {}),
    ...(rg.grupoId ? { grupoId: rg.grupoId } : {}),
  };
  const conId = await validarConsolidador(
    s,
    ids,
    rg.grupoId,
    url.searchParams.get("consolidadorId")
  );
  if (conId) alcance.consolidadorId = conId;

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
      .replace(/[\u0300-\u036f]/g, "");
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
  const [redes, grupos] = await Promise.all([
    redIds.length > 0
      ? await db.red.findMany({ where: { id: { in: redIds as string[] } } })
      : [],
    grupoIds.length > 0
      ? await db.grupo.findMany({
          where: { id: { in: grupoIds as string[] } },
        })
      : [],
  ]);
  const nombreRed = Object.fromEntries(redes.map((r) => [r.id, r.nombre]));
  const nombreGrupo = Object.fromEntries(grupos.map((g) => [g.id, g.nombre]));

  return NextResponse.json(
    lista.map((v) => ({
      id: v.id,
      nombre: v.nombre,
      apellido: v.apellido,
      telefono: v.telefono,
      zona: v.zona,
      estadoActual: v.estadoActual,
      origen: v.origen?.nombre ?? null,
      iglesiaId: v.iglesiaId,
      iglesia: v.iglesia.nombre,
      red: v.redId ? (nombreRed[v.redId] ?? null) : null,
      grupo: v.grupoId ? (nombreGrupo[v.grupoId] ?? null) : null,
      consolidador: v.consolidador
        ? `${v.consolidador.nombre} ${v.consolidador.apellido}`
        : null,
      fechaRegistro: v.createdAt,
    }))
  );
}
