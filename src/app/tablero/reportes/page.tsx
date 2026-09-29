"use client";

import { useMemo, useState } from "react";
import { I, Icono, TarjetaEstado, Vacio, useTablero } from "../ui";

type Periodo = "Semanal" | "Mensual" | "Personalizado";

function aISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function aCorto(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function rangoPorDefecto(p: Periodo): [string, string] {
  const hoy = new Date();
  if (p === "Mensual") {
    return [aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), aISO(hoy)];
  }
  const dia = (hoy.getDay() + 6) % 7; // lunes = 0
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - dia);
  const fin = new Date(lunes);
  fin.setDate(lunes.getDate() + 6);
  return [aISO(lunes), aISO(fin)];
}

const ESTADOS = [
  { titulo: "Desea contactar", pie: "Por contactar", tinta: "bg-navy/10 text-navy", icono: I.telefono },
  { titulo: "Primer contacto", pie: "En primer contacto", tinta: "bg-wine/10 text-wine", icono: I.visitantes },
  { titulo: "Segundo contacto", pie: "En segundo contacto", tinta: "bg-gold/15 text-[#8A6E14]", icono: I.calendario },
  { titulo: "Visita de amistad", pie: "Con visita de amistad", tinta: "bg-[#1F7A4B]/10 text-[#1F7A4B]", icono: I.corazon },
];

export default function Reportes() {
  const { iglesiaId, iglesias, sesion } = useTablero();
  const [periodo, setPeriodo] = useState<Periodo>("Semanal");
  const [inicio, setInicio] = useState(() => rangoPorDefecto("Semanal")[0]);
  const [fin, setFin] = useState(() => rangoPorDefecto("Semanal")[1]);
  const impresion = useMemo(() => new Date().toLocaleString("es-ES"), []);
  const iglesia = iglesias.find((i) => i.id === iglesiaId);

  function elegirPeriodo(p: Periodo) {
    setPeriodo(p);
    if (p !== "Personalizado") {
      const [i, f] = rangoPorDefecto(p);
      setInicio(i);
      setFin(f);
    }
  }

  function preset(tipo: "semana" | "mes" | "anterior") {
    const hoy = new Date();
    if (tipo === "semana") elegirPeriodo("Semanal");
    else if (tipo === "mes") elegirPeriodo("Mensual");
    else {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      setPeriodo("Mensual");
      setInicio(aISO(primero));
      setFin(aISO(ultimo));
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sand/60 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
                <Icono className="h-5 w-5">{I.reporte}</Icono>
              </span>
              <span className="text-[15px] font-black text-navy">Reportes</span>
            </span>
            <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-sand bg-paper px-4 text-sm">
              <span className="text-zinc-500">
                <Icono className="h-4 w-4">{I.calendario}</Icono>
              </span>
              <span className="text-[11px] font-black tracking-[0.08em] text-navy">
                PERIODO:
              </span>
              <select
                aria-label="Periodo del reporte"
                value={periodo}
                onChange={(e) => elegirPeriodo(e.target.value as Periodo)}
                className="cursor-pointer appearance-none bg-transparent font-semibold text-navy outline-none"
              >
                <option value="Semanal">Semanal</option>
                <option value="Mensual">Mensual</option>
                <option value="Personalizado">Personalizado</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["semana", "Esta semana"],
                ["mes", "Este mes"],
                ["anterior", "Mes anterior"],
              ] as const
            ).map(([k, t]) => (
              <button
                key={k}
                onClick={() => preset(k)}
                className="min-h-[44px] cursor-pointer rounded-full border border-sand bg-white px-4 text-[11px] font-black tracking-[0.06em] text-navy uppercase transition-all duration-200 hover:bg-paper"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-sand bg-paper px-4 text-sm">
            <span className="text-[11px] font-black tracking-[0.08em] text-zinc-500">
              INICIO
            </span>
            <input
              type="date"
              value={inicio}
              onChange={(e) => {
                setInicio(e.target.value);
                setPeriodo("Personalizado");
              }}
              className="bg-transparent font-semibold text-navy outline-none"
            />
          </label>
          <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-sand bg-paper px-4 text-sm">
            <span className="text-[11px] font-black tracking-[0.08em] text-zinc-500">
              FIN
            </span>
            <input
              type="date"
              value={fin}
              onChange={(e) => {
                setFin(e.target.value);
                setPeriodo("Personalizado");
              }}
              className="bg-transparent font-semibold text-navy outline-none"
            />
          </label>
          <span className="rounded-full border border-sand bg-paper px-3 py-2 text-xs font-semibold text-zinc-600">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#1F7A4B]" />
            0 de 0 visitantes en rango • {aCorto(inicio)} - {aCorto(fin)}
          </span>
        </div>
      </section>

      <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-sand/60 bg-white p-4">
        <div className="leading-tight">
          <p className="text-[13px] font-black tracking-[0.14em] text-navy">
            I. CUADRANGULAR
          </p>
          <p className="text-[11px] font-bold tracking-[0.08em] text-gold uppercase">
            {iglesia ? iglesia.nombre : "Todas las iglesias"}
          </p>
          <p className="mt-1 text-[14px] font-bold text-navy">
            Reporte de Consolidación - {periodo} - {aCorto(inicio)} - {aCorto(fin)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Rango: {inicio} al {fin} • {iglesias.length} iglesia(s) asignadas
          </p>
        </div>
        <div className="rounded-xl border border-sand bg-paper px-4 py-3 text-right text-xs leading-relaxed text-zinc-600">
          <p>
            <span className="font-bold text-navy">Impresión:</span> {impresion}
          </p>
          <p>
            <span className="font-bold text-navy">Usuario:</span>{" "}
            {sesion ? `${sesion.usuario} (${sesion.rol.toLowerCase()})` : "—"}
          </p>
          <p>
            <span className="font-bold text-navy">Rango:</span> {aCorto(inicio)} -{" "}
            {aCorto(fin)}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ESTADOS.map((e) => (
          <TarjetaEstado
            key={e.titulo}
            icono={e.icono}
            titulo={e.titulo}
            valor={0}
            pie={e.pie}
            tinta={e.tinta}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-sand/60 bg-paper p-4">
          <h3 className="text-[11px] font-black tracking-[0.08em] text-zinc-500 uppercase">
            Por red
          </h3>
          <div className="mt-2">
            <Vacio
              titulo="Sin redes todavía"
              detalle="Las redes de la iglesia aparecerán aquí con sus conteos."
            />
          </div>
        </div>
        <div className="rounded-2xl border border-sand/60 bg-paper p-4">
          <h3 className="text-[11px] font-black tracking-[0.08em] text-zinc-500 uppercase">
            Por grupo
          </h3>
          <div className="mt-2">
            <Vacio
              titulo="Sin grupos todavía"
              detalle="Los grupos de conexión aparecerán aquí con sus conteos."
            />
          </div>
        </div>
        <div className="rounded-2xl bg-navy p-5 text-white">
          <h3 className="text-[11px] font-black tracking-[0.14em] text-gold uppercase">
            Consolidación
          </h3>
          <p className="mt-2 text-[32px] leading-none font-black">0%</p>
          <p className="mt-1 text-[13px] text-white/80">
            de visitantes consolidados en rango
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-valuenow={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Porcentaje de consolidación"
          >
            <div className="h-full w-0 rounded-full bg-gold" />
          </div>
          <p className="mt-3 text-xs text-white/70">
            0 consolidados de 0 totales • {periodo} - {aCorto(inicio)} -{" "}
            {aCorto(fin)}
          </p>
        </div>
      </div>
    </div>
  );
}
