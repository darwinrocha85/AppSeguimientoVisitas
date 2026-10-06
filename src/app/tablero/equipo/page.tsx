"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { I, Icono, Vacio, useTablero } from "../ui";
import { formatearTelefono } from "@/lib/telefono";

type PersonaEquipo = {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  rol: string;
  detalle: string | null;
};

type GrupoEquipo = { id: string; nombre: string; personas: PersonaEquipo[] };
type RedEquipo = {
  id: string;
  nombre: string;
  lider?: PersonaEquipo | null;
  grupos?: GrupoEquipo[];
};

type Equipo = {
  pastor?: PersonaEquipo | null;
  liderConsolidador?: PersonaEquipo | null;
  lideresConsolidadores?: PersonaEquipo[];
  liderRed?: PersonaEquipo | null;
  liderGrupo?: PersonaEquipo | null;
  consolidadores?: PersonaEquipo[];
  grupos?: GrupoEquipo[];
  redes?: RedEquipo[];
  iglesia?: { id: string; nombre: string } | null;
} | null;

function FichaPersona({ p, href }: { p: PersonaEquipo; href?: string }) {
  const nombre = (
    <span className="block truncate text-[14px] font-bold text-navy">
      {p.nombre} {p.apellido}
    </span>
  );
  return (
    <li className="flex min-w-[240px] snap-start items-center gap-3 rounded-xl border border-sand/70 bg-paper p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-base font-black text-navy">
        {p.nombre.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        {href ? (
          <Link
            href={href}
            title={`Ver información y visitantes de ${p.nombre} ${p.apellido}`}
            className="underline-offset-2 hover:underline"
          >
            {nombre}
          </Link>
        ) : (
          nombre
        )}
        <span className="mt-0.5 block truncate text-xs text-zinc-500">
          {p.detalle ?? ""}
          {p.telefono ? ` • ${formatearTelefono(p.telefono)}` : ""}
        </span>
      </span>
    </li>
  );
}

function BloqueGrupo({
  g,
  hrefDe,
}: {
  g: GrupoEquipo;
  hrefDe?: (p: PersonaEquipo) => string | undefined;
}) {
  return (
    <div key={g.id} className="mt-3">
      <h3 className="text-[13px] font-black text-navy">{g.nombre}</h3>
      {g.personas.length === 0 ? (
        <p className="text-xs text-zinc-500">Sin personas todavía.</p>
      ) : (
        <ul className="mt-1.5 flex snap-x gap-2 overflow-x-auto pb-1">
          {g.personas.map((p) => (
            <FichaPersona key={p.id} p={p} href={hrefDe?.(p)} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Equipo() {
  const { sesion, iglesias, iglesiaId, red, grupo, consolidador } = useTablero();
  const [equipo, setEquipo] = useState<Equipo>(null);
  const [cargando, setCargando] = useState(true);

  const esGestor =
    sesion?.rol === "PASTOR" ||
    sesion?.rol === "LIDER_CONSOLIDADOR" ||
    sesion?.rol === "SUPERADMIN";
  const idIglesia = esGestor ? iglesiaId || iglesias[0]?.id || "" : "";

  // El nombre lleva a su información y visitantes asignados (los que
  // consolidan; el pastor no consolida y el raso ya ve solo lo suyo).
  function hrefVisita(p: PersonaEquipo): string | undefined {
    if (sesion?.rol === "CONSOLIDADOR") return undefined;
    if (
      !["CONSOLIDADOR", "LIDER_RED", "LIDER_GRUPO", "LIDER_CONSOLIDADOR"].includes(
        p.rol
      )
    )
      return undefined;
    return `/tablero/visitantes?consolidador=${p.id}`;
  }

  // La vista respeta los filtros superiores de red/grupo/consolidador,
  // igual que Usuarios (los datos ya vienen del alcance propio).
  function soloRed<T extends { id: string }>(rs: T[]) {
    return red === "todas" ? rs : rs.filter((r) => r.id === red);
  }
  function soloGrupo<T extends { id: string }>(gs: T[]) {
    return grupo === "todos" ? gs : gs.filter((g) => g.id === grupo);
  }
  function soloConso(ps: PersonaEquipo[]) {
    return consolidador === "todos"
      ? ps
      : ps.filter((p) => p.id === consolidador);
  }

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const url =
        esGestor && idIglesia
          ? `/api/tablero/equipo?iglesiaId=${idIglesia}`
          : "/api/tablero/equipo";
      // Superadmin sin iglesia elegida: no hay equipo que mostrar.
      if (sesion?.rol === "SUPERADMIN" && !idIglesia) {
        setEquipo(null);
        setCargando(false);
        return;
      }
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        setEquipo(j.equipo);
      }
      setCargando(false);
    }
    void cargar();
  }, [esGestor, idIglesia, sesion?.rol]);

  if (cargando) {
    return (
      <p className="text-sm font-semibold text-navy">Cargando equipo…</p>
    );
  }

  if (sesion?.rol === "SUPERADMIN" && !idIglesia) {
    return (
      <Vacio
        titulo="Elige una iglesia"
        detalle="Selecciona una iglesia en el filtro de arriba para ver su equipo."
      />
    );
  }

  if (!equipo) {
    return (
      <Vacio
        titulo="Sin equipo para mostrar"
        detalle="Aún no hay personas asignadas en este alcance."
      />
    );
  }

  // Líder de red: dos bloques (Mi equipo / Mi equipo de red).
  if (sesion?.rol === "LIDER_RED") {
    const gruposRed = soloGrupo(equipo.grupos ?? []);
    return (
      <div className="space-y-5">
        <section className="rounded-2xl border border-sand/60 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grape text-white">
              <Icono className="h-5 w-5">{I.usuarioMas}</Icono>
            </span>
            <div className="leading-tight">
              <h2 className="text-[15px] font-black text-navy">Mi equipo</h2>
              <p className="text-xs text-zinc-500">
                Pastor y líder de consolidación de tu iglesia
              </p>
            </div>
          </div>
          <ul className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
            {[equipo.pastor, equipo.liderConsolidador]
              .filter((p): p is PersonaEquipo => !!p)
              .map((p) => (
                <FichaPersona key={p.id} p={p} href={hrefVisita(p)} />
              ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-sand/60 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
              <Icono className="h-5 w-5">{I.visitantes}</Icono>
            </span>
            <div className="leading-tight">
              <h2 className="text-[15px] font-black text-navy">Mi equipo de red</h2>
              <p className="text-xs text-zinc-500">
                Líderes de grupo y consolidadores de tu red
              </p>
            </div>
          </div>
          {gruposRed.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              Sin grupos en este filtro.
            </p>
          ) : (
            gruposRed.map((g) => (
              <BloqueGrupo key={g.id} g={g} hrefDe={hrefVisita} />
            ))
          )}
        </section>
      </div>
    );
  }

  // Gestores y superadmin: equipo de la iglesia por redes.
  if (esGestor) {
    const redesFiltradas = soloRed(equipo.redes ?? [])
      .map((r) => ({ ...r, grupos: soloGrupo(r.grupos ?? []) }))
      .filter((r) => grupo === "todos" || (r.grupos ?? []).length > 0);
    return (
      <div className="space-y-5">
        <section className="rounded-2xl border border-sand/60 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grape text-white">
              <Icono className="h-5 w-5">{I.usuarioMas}</Icono>
            </span>
            <div className="leading-tight">
              <h2 className="text-[15px] font-black text-navy">
                Mi equipo{equipo.iglesia ? ` • ${equipo.iglesia.nombre}` : ""}
              </h2>
              <p className="text-xs text-zinc-500">
                Pastor y líderes de consolidación
              </p>
            </div>
          </div>
          <ul className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
            {[equipo.pastor, ...(equipo.lideresConsolidadores ?? [])]
              .filter((p): p is PersonaEquipo => !!p)
              .map((p) => (
                <FichaPersona key={p.id} p={p} href={hrefVisita(p)} />
              ))}
          </ul>
        </section>
        {redesFiltradas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-sand bg-white/60 px-6 py-8 text-center text-sm text-zinc-500">
            Sin redes en este filtro.
          </p>
        )}
        {redesFiltradas.map((r) => (
          <section
            key={r.id}
            className="rounded-2xl border border-sand/60 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
                <Icono className="h-5 w-5">{I.visitantes}</Icono>
              </span>
              <div className="leading-tight">
                <h2 className="text-[15px] font-black text-navy">{r.nombre}</h2>
                <p className="text-xs text-zinc-500">
                  {r.lider
                    ? `Líder de red: ${r.lider.nombre} ${r.lider.apellido}`
                    : "Sin líder de red asignado"}
                </p>
              </div>
            </div>
            {(r.grupos ?? []).map((g) => (
              <BloqueGrupo key={g.id} g={g} hrefDe={hrefVisita} />
            ))}
          </section>
        ))}
      </div>
    );
  }

  // Líder de grupo y consolidador: bloque único.
  return (
    <section className="rounded-2xl border border-sand/60 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grape text-white">
          <Icono className="h-5 w-5">{I.usuarioMas}</Icono>
        </span>
        <div className="leading-tight">
          <h2 className="text-[15px] font-black text-navy">Mi equipo</h2>
          <p className="text-xs text-zinc-500">
            Quiénes te acompañan en tu alcance
          </p>
        </div>
      </div>
      <ul className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
        {[equipo.pastor, equipo.liderConsolidador, equipo.liderRed, equipo.liderGrupo]
          .filter((p): p is PersonaEquipo => !!p)
          .map((p) => (
            <FichaPersona key={p.id} p={p} href={hrefVisita(p)} />
          ))}
        {soloConso(equipo.consolidadores ?? []).map((p) => (
          <FichaPersona key={p.id} p={p} href={hrefVisita(p)} />
        ))}
      </ul>
      {(equipo.grupos ?? []).map((g) => (
        <BloqueGrupo key={g.id} g={g} hrefDe={hrefVisita} />
      ))}
    </section>
  );
}
