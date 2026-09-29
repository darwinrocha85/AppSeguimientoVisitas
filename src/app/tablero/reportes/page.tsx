"use client";

import { useEffect, useMemo, useState } from "react";
import { I, Icono, TarjetaEstado, Vacio, useTablero } from "../ui";

type Periodo = "UltimoMes" | "Semanal" | "Mensual" | "Personalizado";

type Stats = {
  total: number;
  porEstado: Record<string, number>;
  porRed: { id: string; nombre: string; total: number }[];
  porGrupo: { id: string; nombre: string; total: number }[];
  consolidados: number;
  conAvance: number;
  exitoPct: number;
};

function aISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function aCorto(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function sumaDias(base: Date, dias: number) {
  const d = new Date(base);
  d.setDate(base.getDate() + dias);
  return d;
}

/** Por defecto, el último mes (AGENTS.md). */
function rangoInicial(): [string, string] {
  const hoy = new Date();
  return [aISO(sumaDias(hoy, -29)), aISO(hoy)];
}

function rangoPorDefecto(p: Periodo): [string, string] {
  const hoy = new Date();
  if (p === "UltimoMes") return rangoInicial();
  if (p === "Mensual") {
    return [aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), aISO(hoy)];
  }
  const dia = (hoy.getDay() + 6) % 7; // lunes = 0
  const lunes = sumaDias(hoy, -dia);
  return [aISO(lunes), aISO(sumaDias(lunes, 6))];
}

const ESTADOS = [
  { clave: "DESEA_SER_CONTACTADO", titulo: "Desea contactar", pie: "Por contactar", tinta: "bg-navy/10 text-navy", icono: I.telefono },
  { clave: "PRIMER_CONTACTO", titulo: "Primer contacto", pie: "En primer contacto", tinta: "bg-wine/10 text-wine", icono: I.visitantes },
  { clave: "SEGUNDO_CONTACTO", titulo: "Segundo contacto", pie: "En segundo contacto", tinta: "bg-gold/15 text-[#8A6E14]", icono: I.calendario },
  { clave: "VISITA_AMISTAD", titulo: "Visita de amistad", pie: "Con visita de amistad", tinta: "bg-[#1F7A4B]/10 text-[#1F7A4B]", icono: I.corazon },
];

type Punto = {
  clave: string;
  total: number;
  porEstado: Record<string, number>;
};

const ETIQUETA_PERIODO: Record<Periodo, string> = {
  UltimoMes: "Último mes",
  Semanal: "Semanal",
  Mensual: "Mensual",
  Personalizado: "Personalizado",
};

const SERIES = [
  { clave: "DESEA_SER_CONTACTADO", texto: "Desea", color: "#204b6e" },
  { clave: "PRIMER_CONTACTO", texto: "1er", color: "#a91e32" },
  { clave: "SEGUNDO_CONTACTO", texto: "2do", color: "#8a6e14" },
  { clave: "VISITA_AMISTAD", texto: "Amistad", color: "#1f7a4b" },
];

function etiquetaCorta(clave: string) {
  const [, m, d] = clave.split("-");
  return `${d}/${m}`;
}

/** Curva suave tipo seno (Catmull-Rom a Bézier) por una serie de puntos. */
function lineaSuave(
  puntos: { x: number; y: number }[],
  yMin: number
): string {
  if (puntos.length < 2) return puntos.map((p) => `${p.x},${p.y}`).join(" ");
  // Sujeta los controles a yMin para que la curva nunca baje de cero.
  const sujeta = (y: number) => Math.min(y, yMin);
  let d = `M ${puntos[0].x},${puntos[0].y}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[Math.max(0, i - 1)];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[Math.min(puntos.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = sujeta(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = sujeta(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Gráfica SVG propia (sin librerías): avances por estado en el tiempo. */
function GraficaEvolucion({
  puntos,
  visibles,
  onToggle,
}: {
  puntos: Punto[];
  visibles: Record<string, boolean>;
  onToggle: (clave: string) => void;
}) {
  const W = 720;
  const H = 250;
  const padL = 30;
  const padB = 26;
  const padT = 12;
  const activas = SERIES.filter((s) => visibles[s.clave]);
  const max = Math.max(
    1,
    ...puntos.map((p) =>
      Math.max(...activas.map((s) => p.porEstado[s.clave] ?? 0), 0)
    )
  );
  const px = (i: number) =>
    padL + (i * (W - padL - 14)) / Math.max(1, puntos.length - 1);
  const py = (v: number) => H - padB - (v * (H - padB - padT)) / max;
  const cada = Math.max(1, Math.ceil(puntos.length / 8));
  // Filas horizontales de uno en uno.
  const filas: number[] = [];
  for (let v = 0; v <= max; v++) filas.push(v);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Evolución de avances por estado"
      >
        {filas.map((v) => (
          <g key={v}>
            <line
              x1={padL}
              x2={W - 6}
              y1={py(v)}
              y2={py(v)}
              stroke="#e8dcc6"
              strokeWidth={1}
            />
            <text x={4} y={py(v) + 4} fontSize={11} fill="#8b7e66">
              {v}
            </text>
          </g>
        ))}
        {activas.map((s) => {
          const pts = puntos.map((p, i) => ({
            x: px(i),
            y: py(p.porEstado[s.clave] ?? 0),
          }));
          return (
            <g key={s.clave}>
              <path
                d={lineaSuave(pts, py(0))}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.map((pt, i) =>
                (puntos[i].porEstado[s.clave] ?? 0) > 0 ? (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={3.5}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                ) : null
              )}
            </g>
          );
        })}
        {puntos.map((p, i) =>
          i % cada === 0 ? (
            <text
              key={p.clave}
              x={px(i)}
              y={H - 8}
              fontSize={11}
              fill="#8b7e66"
              textAnchor="middle"
            >
              {etiquetaCorta(p.clave)}
            </text>
          ) : null
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-2">
        {SERIES.map((s) => {
          const on = !!visibles[s.clave];
          const esUltima =
            on && activas.length === 1;
          return (
            <button
              key={s.clave}
              onClick={() => !esUltima && onToggle(s.clave)}
              aria-pressed={on}
              title={esUltima ? "Debe quedar una visible" : `Ver ${s.texto}`}
              className={`flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-all ${
                on
                  ? "border-navy/30 bg-white text-navy"
                  : "border-sand bg-paper text-zinc-400"
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: on ? s.color : "#d6cbb8" }}
              />
              {s.texto}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Reportes() {
  const { iglesiaId, red, grupo, consolidador, resumen } =
    useTablero();
  const [periodo, setPeriodo] = useState<Periodo>("UltimoMes");
  const [inicio, setInicio] = useState(() => rangoInicial()[0]);
  const [fin, setFin] = useState(() => rangoInicial()[1]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [verEvolucion, setVerEvolucion] = useState(false);
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const conCambios = useMemo(
    () => puntos.filter((p) => p.total > 0),
    [puntos]
  );
  const [visibles, setVisibles] = useState<Record<string, boolean>>({
    DESEA_SER_CONTACTADO: true,
    PRIMER_CONTACTO: true,
    SEGUNDO_CONTACTO: true,
    VISITA_AMISTAD: true,
  });

  function conFiltros(extra: URLSearchParams) {
    if (iglesiaId) extra.set("iglesiaId", iglesiaId);
    if (red !== "todas") extra.set("redId", red);
    if (grupo !== "todos") extra.set("grupoId", grupo);
    if (consolidador !== "todos") extra.set("consolidadorId", consolidador);
    return extra;
  }

  useEffect(() => {
    async function cargar() {
      const qs = conFiltros(new URLSearchParams({ inicio, fin }));
      const r = await fetch(`/api/tablero/estadisticas?${qs.toString()}`);
      if (r.ok) setStats(await r.json());
      else setStats(null);
    }
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fin, iglesiaId, red, grupo, consolidador]);

  useEffect(() => {
    if (!verEvolucion) return;
    async function cargar() {
      const qs = conFiltros(new URLSearchParams({ inicio, fin }));
      const r = await fetch(`/api/tablero/evolucion?${qs.toString()}`);
      if (r.ok) {
        const j = await r.json();
        setPuntos(j.puntos ?? []);
      } else setPuntos([]);
    }
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verEvolucion, inicio, fin, iglesiaId, red, grupo, consolidador]);

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
    if (tipo === "semana") {
      elegirPeriodo("Semanal");
    } else if (tipo === "mes") {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      setPeriodo("Personalizado");
      setInicio(aISO(primero));
      setFin(aISO(ultimo));
    } else {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      setPeriodo("Personalizado");
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
                <option value="UltimoMes">Último mes</option>
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
            {stats ? stats.total : "…"} de {resumen?.total ?? "…"} visitantes en
            rango • {aCorto(inicio)} - {aCorto(fin)}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ESTADOS.map((e) => (
          <TarjetaEstado
            key={e.clave}
            icono={e.icono}
            titulo={e.titulo}
            valor={stats?.porEstado[e.clave] ?? "…"}
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
          {!stats || stats.porRed.length === 0 ? (
            <div className="mt-2">
              <Vacio
                titulo="Sin movimientos en rango"
                detalle="Ningún visitante cambió de estado en estas fechas."
              />
            </div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {stats.porRed.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="font-semibold text-navy">{r.nombre}</span>
                  <span className="rounded-full border border-sand bg-white px-2.5 py-0.5 text-xs font-black text-navy">
                    {r.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-sand/60 bg-paper p-4">
          <h3 className="text-[11px] font-black tracking-[0.08em] text-zinc-500 uppercase">
            Por grupo
          </h3>
          {!stats || stats.porGrupo.length === 0 ? (
            <div className="mt-2">
              <Vacio
                titulo="Sin movimientos en rango"
                detalle="Ningún visitante cambió de estado en estas fechas."
              />
            </div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {stats.porGrupo.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="font-semibold text-navy">{g.nombre}</span>
                  <span className="rounded-full border border-sand bg-white px-2.5 py-0.5 text-xs font-black text-navy">
                    {g.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl bg-navy p-5 text-white">
          <h3 className="text-[11px] font-black tracking-[0.14em] text-gold uppercase">
            Éxito
          </h3>
          <p className="mt-2 text-[32px] leading-none font-black">
            {stats ? `${stats.exitoPct}%` : "…"}
          </p>
          <p className="mt-1 text-[13px] text-white/80">
            de visitantes con avance a tiempo en rango
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-valuenow={stats?.exitoPct ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Porcentaje de éxito"
          >
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${stats?.exitoPct ?? 0}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-white/70">
            {stats ? stats.conAvance : "…"} con avance a tiempo de{" "}
            {stats ? stats.total : "…"} totales • {ETIQUETA_PERIODO[periodo]} -{" "}
            {aCorto(inicio)} - {aCorto(fin)}
          </p>
        </div>
      </div>

      {verEvolucion && (
        <section className="rounded-2xl border border-sand/60 bg-white p-4">
          <h3 className="text-[15px] font-black text-navy">
            Evolución en el tiempo
          </h3>
          <p className="mb-3 text-xs text-zinc-500">
            Solo días con cambios ({conCambios.length} de {puntos.length} en
            rango). Toca una serie para mostrarla u ocultarla.
          </p>
          {conCambios.length === 0 ? (
            <Vacio
              titulo="Sin movimientos"
              detalle="No hubo cambios de estado en este rango."
            />
          ) : (
            <GraficaEvolucion
              puntos={conCambios}
              visibles={visibles}
              onToggle={(clave) =>
                setVisibles((v) => ({ ...v, [clave]: !v[clave] }))
              }
            />
          )}
        </section>
      )}

      <div className="no-print flex flex-wrap gap-2">
        <button
          onClick={() => window.print()}
          className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-navy px-5 text-[12px] font-black tracking-[0.06em] text-white uppercase transition-all duration-200 hover:bg-navy-dark"
        >
          <Icono className="h-4 w-4">{I.reporte}</Icono>
          Generar PDF
        </button>
        <button
          onClick={() => setVerEvolucion((v) => !v)}
          aria-expanded={verEvolucion}
          className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-navy/30 bg-white px-5 text-[12px] font-black tracking-[0.06em] text-navy uppercase transition-all duration-200 hover:bg-paper"
        >
          <Icono className="h-4 w-4">{I.calendario}</Icono>
          {verEvolucion ? "Ocultar evolución" : "Ver evolución"}
        </button>
      </div>
    </div>
  );
}
