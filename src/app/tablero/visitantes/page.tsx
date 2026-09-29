"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { I, Icono, Vacio, useTablero } from "../ui";
import { formatearTelefono } from "@/lib/telefono";

type Visitante = {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  zona: string;
  estadoActual: string;
  origen: string | null;
  iglesiaId: string;
  iglesia: string;
  red: string | null;
  grupo: string | null;
  consolidador: string | null;
  fechaRegistro: string;
};

const INSIGNIA_ESTADO: Record<string, { texto: string; clases: string }> = {
  DESEA_SER_CONTACTADO: {
    texto: "Nuevo",
    clases: "border-wine/20 bg-wine/10 text-wine",
  },
  PRIMER_CONTACTO: {
    texto: "1er contacto",
    clases: "border-gold/30 bg-gold/15 text-[#8A6E14]",
  },
  SEGUNDO_CONTACTO: {
    texto: "2do contacto",
    clases: "border-navy/20 bg-navy/5 text-navy",
  },
  VISITA_AMISTAD: {
    texto: "Visita amistad",
    clases: "border-[#1F7A4B]/20 bg-[#1F7A4B]/10 text-[#1F7A4B]",
  },
};

function iniciales(n: string, a: string) {
  return `${n.charAt(0)}${a.charAt(0)}`.toUpperCase();
}

export default function Visitantes() {
  const { iglesiaId, iglesias, red, grupo, consolidador, setIglesiaId, setRed, setGrupo, setConsolidador } =
    useTablero();
  const [busqueda, setBusqueda] = useState("");
  const [lista, setLista] = useState<Visitante[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Búsqueda con debounce sobre la cascada y el texto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    const t = setTimeout(async () => {
      const qs = new URLSearchParams();
      if (iglesiaId) qs.set("iglesiaId", iglesiaId);
      if (red !== "todas") qs.set("redId", red);
      if (grupo !== "todos") qs.set("grupoId", grupo);
      if (consolidador !== "todos") qs.set("consolidadorId", consolidador);
      if (busqueda.trim()) qs.set("q", busqueda.trim());
      const r = await fetch(`/api/visitantes?${qs.toString()}`);
      if (r.ok) setLista(await r.json());
      setCargando(false);
    }, 350);
    return () => clearTimeout(t);
  }, [iglesiaId, red, grupo, consolidador, busqueda]);

  const iglesia = iglesias.find((i) => i.id === iglesiaId);

  return (
    <section className="rounded-2xl border border-sand/60 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
            <Icono className="h-5 w-5">{I.visitantes}</Icono>
          </span>
          <div className="leading-tight">
            <h2 className="text-[15px] font-black text-navy">
              Visitantes • {lista.length}
            </h2>
            <p className="text-xs text-zinc-500">
              Iglesia: {iglesia ? iglesia.nombre : "Todas"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-sand bg-paper px-4 text-sm">
            <span className="text-zinc-400">
              <Icono className="h-4 w-4">{I.buscar}</Icono>
            </span>
            <input
              aria-label="Buscar por nombre o teléfono"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o teléfono"
              className="w-44 bg-transparent text-navy outline-none placeholder:text-[#B8A99A]/70"
            />
          </label>
          <button
            disabled
            title="Próximamente: registro de visitantes"
            className="flex min-h-[44px] cursor-not-allowed items-center gap-1.5 rounded-full bg-wine px-5 text-sm font-black tracking-wide text-white uppercase opacity-60"
          >
            <Icono className="h-4 w-4">{I.mas}</Icono>
            Nuevo
          </button>
        </div>
      </div>
      <div className="mt-4">
        {cargando ? (
          <p className="py-6 text-center text-sm font-semibold text-navy">
            Cargando visitantes…
          </p>
        ) : lista.length === 0 ? (
          <Vacio
            titulo="Sin visitantes en este filtro"
            detalle="Ajusta la iglesia o la búsqueda, o espera a que se registren los primeros visitantes."
          />
        ) : (
          <ul className="space-y-2">
            {lista.map((v) => {
              const ins =
                INSIGNIA_ESTADO[v.estadoActual] ?? INSIGNIA_ESTADO.DESEA_SER_CONTACTADO;
              return (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-sand/70 bg-paper p-3"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sand bg-white text-sm font-black text-navy">
                    {iniciales(v.nombre, v.apellido)}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-bold text-navy">
                        {v.nombre} {v.apellido}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-black tracking-[0.06em] uppercase ${ins.clases}`}
                      >
                        {ins.texto}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {v.telefono && `${formatearTelefono(v.telefono)} • `}
                      <Link
                        href={`/tablero/iglesias/${v.iglesiaId}`}
                        title={`Ver ${v.iglesia}`}
                        onClick={() => {
                          setIglesiaId(v.iglesiaId);
                          setRed("todas");
                          setGrupo("todos");
                          setConsolidador("todos");
                        }}
                        className="font-semibold text-navy/80 underline-offset-2 hover:underline"
                      >
                        {v.iglesia}
                      </Link>
                      {[v.red, v.grupo].filter(Boolean).length > 0 &&
                        ` • ${[v.red, v.grupo].filter(Boolean).join(" • ")}`}
                      {v.origen && ` • ${v.origen}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border border-sand bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600">
                      {new Date(v.fechaRegistro).toLocaleDateString("es-ES")}
                    </span>
                    <span className="rounded-full bg-navy px-3 py-1.5 text-xs font-bold text-white">
                      {ins.texto}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
