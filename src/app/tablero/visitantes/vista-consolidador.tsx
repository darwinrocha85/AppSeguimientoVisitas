"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { I, Icono, TarjetaEstado } from "../ui";
import { formatearTelefono } from "@/lib/telefono";

export type VisitanteRaso = {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  zona: string;
  estadoActual: string;
  origen: string | null;
  iglesiaId: string;
  iglesia: string;
  grupo: string | null;
  fechaRegistro: string;
  ultimoCambio: string;
};

const TARJETAS = [
  {
    clave: "DESEA_SER_CONTACTADO",
    titulo: "Desea contactar",
    pie: "Por contactar",
    tinta: "bg-navy/10 text-navy",
    icono: I.telefono,
  },
  {
    clave: "PRIMER_CONTACTO",
    titulo: "Primer contacto",
    pie: "Primer contacto realizado",
    tinta: "bg-wine/10 text-wine",
    icono: I.visitantes,
  },
  {
    clave: "SEGUNDO_CONTACTO",
    titulo: "Segundo contacto",
    pie: "Segundo contacto realizado",
    tinta: "bg-gold/15 text-[#8A6E14]",
    icono: I.calendario,
  },
  {
    clave: "VISITA_AMISTAD",
    titulo: "Visita de amistad",
    pie: "Visitas de amistad",
    tinta: "bg-[#1F7A4B]/10 text-[#1F7A4B]",
    icono: I.corazon,
  },
];

const COLOR_ORIGEN: Record<string, string> = {
  Evangelismo: "#a91e32",
  "Operación Mateo 25": "#204b6e",
  "1ra visita grupo": "#c9a227",
  "1ra visita iglesia": "#4b306a",
};

function horasDesde(iso: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  );
}

function digitos(tel: string | null) {
  return (tel ?? "").replace(/\D/g, "");
}

/** Vista del consolidador según images_test/view_consolidador.png */
export function VistaConsolidador({
  lista,
  alertas,
  estadoInicial = null,
  onCambio,
}: {
  lista: VisitanteRaso[];
  alertas: { iglesiaId: string; estado: string; maxHoras: number }[];
  estadoInicial?: string | null;
  onCambio?: () => void;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<"todos" | "pendientes" | "reportados">(
    "todos"
  );
  const [estado, setEstado] = useState<string | null>(estadoInicial);
  const [reporteId, setReporteId] = useState<string | null>(null);
  const [fechaContacto, setFechaContacto] = useState("");
  const [obsReporte, setObsReporte] = useState("");
  const [errorReporte, setErrorReporte] = useState("");
  const [guardandoReporte, setGuardandoReporte] = useState(false);
  const esReportado = (v: VisitanteRaso) =>
    v.estadoActual === "SEGUNDO_CONTACTO" ||
    v.estadoActual === "VISITA_AMISTAD";
  /** Pendiente = venció su tiempo sin reportar. Al día = en tiempo. */
  const esPendiente = (v: VisitanteRaso) =>
    horasDesde(v.ultimoCambio) > limiteDe(v);

  const SIGUIENTE: Record<string, { estado: string; etiqueta: string }> = {
    DESEA_SER_CONTACTADO: { estado: "PRIMER_CONTACTO", etiqueta: "Primer contacto" },
    PRIMER_CONTACTO: { estado: "SEGUNDO_CONTACTO", etiqueta: "Segundo contacto" },
    SEGUNDO_CONTACTO: { estado: "VISITA_AMISTAD", etiqueta: "Visita de amistad" },
    VISITA_AMISTAD: { estado: "VISITA_AMISTAD", etiqueta: "Otra visita de amistad" },
  };

  function ahoraLocal() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function abrirReporte(v: VisitanteRaso) {
    setReporteId(v.id);
    setFechaContacto(ahoraLocal());
    setObsReporte("");
    setErrorReporte("");
  }

  async function guardarReporte() {
    if (!reporteId) return;
    const v = lista.find((x) => x.id === reporteId);
    if (!v) return;
    setErrorReporte("");
    setGuardandoReporte(true);
    const r = await fetch(`/api/visitantes/${reporteId}/reporte`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aEstado: SIGUIENTE[v.estadoActual]?.estado ?? v.estadoActual,
        fechaContacto: fechaContacto ? new Date(fechaContacto).toISOString() : null,
        observaciones: obsReporte || null,
      }),
    });
    setGuardandoReporte(false);
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      setErrorReporte(j?.error ?? "No se pudo guardar el reporte");
      return;
    }
    setReporteId(null);
    if (onCambio) onCambio();
    else router.refresh();
  }

  const reporteDe = reporteId ? lista.find((x) => x.id === reporteId) ?? null : null;

  /** Estatus de la tarjeta: qué falta reportar (vencido) o qué va al día. */
  function estatus(v: VisitanteRaso): { texto: string; vencido: boolean } {
    const hs = horasDesde(v.ultimoCambio);
    const vencido = hs > limiteDe(v);
    if (v.estadoActual === "DESEA_SER_CONTACTADO") {
      return vencido
        ? { texto: "Pendiente: 1er contacto", vencido }
        : { texto: "Desea contactar", vencido };
    }
    if (v.estadoActual === "PRIMER_CONTACTO") {
      return vencido
        ? { texto: "Pendiente: segundo contacto", vencido }
        : { texto: "Al día: primer contacto", vencido };
    }
    if (v.estadoActual === "SEGUNDO_CONTACTO") {
      return vencido
        ? { texto: "Pendiente: visita de amistad", vencido }
        : { texto: "Al día: 2do contacto", vencido };
    }
    return vencido
      ? { texto: "Pendiente: visita de amistad", vencido }
      : { texto: "Al día: visita de amistad", vencido };
  }

  // Cada tarjeta cuadra: total = al día (en tiempo) + pendientes
  // (vencidos de ese mismo estado). A dónde debe reportarse lo dice la
  // insignia de cada visitante ("Pendiente: segundo contacto", etc.).
  const porTarjeta = useMemo(() => {
    const limite = (v: VisitanteRaso) =>
      alertas.find(
        (a) => a.iglesiaId === v.iglesiaId && a.estado === v.estadoActual
      )?.maxHoras ?? 100;
    const enTiempo = (v: VisitanteRaso) =>
      horasDesde(v.ultimoCambio) <= limite(v);
    const parte = (e: string) => {
      const alDia = lista.filter(
        (v) => v.estadoActual === e && enTiempo(v)
      ).length;
      const total = lista.filter((v) => v.estadoActual === e).length;
      return { total, alDia, pendiente: total - alDia };
    };
    return {
      DESEA_SER_CONTACTADO: parte("DESEA_SER_CONTACTADO"),
      PRIMER_CONTACTO: parte("PRIMER_CONTACTO"),
      SEGUNDO_CONTACTO: parte("SEGUNDO_CONTACTO"),
      VISITA_AMISTAD: parte("VISITA_AMISTAD"),
    } as Record<string, { total: number; alDia: number; pendiente: number }>;
  }, [lista, alertas]);

  function limiteDe(v: VisitanteRaso) {
    return (
      alertas.find(
        (a) => a.iglesiaId === v.iglesiaId && a.estado === v.estadoActual
      )?.maxHoras ?? 100
    );
  }
  const reportados = lista.filter((v) => !esPendiente(v));
  const pendientes = lista.filter(esPendiente);
  const vencidos = lista.filter(
    (v) => horasDesde(v.ultimoCambio) > limiteDe(v)
  );
  const visible = lista.filter((v) => {
    if (estado && v.estadoActual !== estado) return false;
    if (filtro === "pendientes") return esPendiente(v);
    if (filtro === "reportados") return !esPendiente(v);
    return true;
  });
  const origenes = useMemo(
    () => [...new Set(lista.map((v) => v.origen).filter(Boolean))] as string[],
    [lista]
  );

  const pestanas = [
    { id: "todos", texto: "Todos" },
    { id: "pendientes", texto: "Pendientes" },
    { id: "reportados", texto: "Al día" },
  ] as const;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-navy">
            Mis visitantes <span className="text-grape">asignados</span>
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Solo ves lo tuyo, no estadísticas globales · Solo crear y editar
            reporte, NO eliminar
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Filtrar visitantes">
          {pestanas.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={filtro === p.id}
              onClick={() => setFiltro(p.id)}
              className={`min-h-[36px] cursor-pointer rounded-full px-4 text-[11px] font-black tracking-[0.06em] uppercase transition-all ${
                filtro === p.id
                  ? "bg-navy text-white"
                  : "border border-sand bg-white text-zinc-500 hover:bg-paper"
              }`}
            >
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TARJETAS.map((t) => (
          <div
            key={t.clave}
            onClick={() => {
              setEstado((e) => (e === t.clave ? null : t.clave));
              setFiltro("todos");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEstado((s) => (s === t.clave ? null : t.clave));
                setFiltro("todos");
              }
            }}
            role="button"
            tabIndex={0}
            aria-pressed={estado === t.clave}
            title={`Filtrar: ${t.titulo}`}
            className={`cursor-pointer ${estado && estado !== t.clave ? "opacity-50" : ""}`}
          >
            <TarjetaEstado
              icono={t.icono}
              titulo={t.titulo}
              valor={porTarjeta[t.clave]?.total ?? 0}
              pie={t.pie}
              tinta={t.tinta}
              detalle={`${porTarjeta[t.clave]?.alDia ?? 0} al día${
                (porTarjeta[t.clave]?.pendiente ?? 0) > 0
                  ? ` · ${porTarjeta[t.clave].pendiente} pendientes`
                  : ""
              }`}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {reportados.length} al día · {pendientes.length} pendientes
        {estado && (
          <button
            onClick={() => setEstado(null)}
            className="ml-2 cursor-pointer rounded-full border border-navy/30 bg-navy/5 px-3 py-1 text-[11px] font-black text-navy"
          >
            Quitar filtro ✕
          </button>
        )}
      </p>

      {vencidos.length > 0 && (
        <div
          role="alert"
          className="mt-3 rounded-2xl bg-wine p-4 text-white"
        >
          <p className="text-[13px] font-black tracking-[0.06em] uppercase">
            Alerta · Acción requerida
          </p>
          <p className="mt-0.5 text-[13px] text-white/90">
            Tienes {vencidos.length} visitante(s) fuera de su tiempo sin
            reporte. Coordina visita y llena el reporte para no perder el
            contacto.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vencidos.slice(0, 10).map((v) => (
              <span
                key={v.id}
                className="rounded-full bg-white px-3 py-1 text-xs font-bold text-wine"
              >
                {v.nombre} {v.apellido}
              </span>
            ))}
            {vencidos.length > 10 && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">
                +{vencidos.length - 10} más
              </span>
            )}
          </div>
        </div>
      )}

      {origenes.length > 0 && (
        <p className="mt-4 text-[11px] font-bold tracking-[0.06em] text-zinc-500 uppercase">
          Origen:{" "}
          {origenes.map((o, i) => (
            <span key={o} className="mr-3 whitespace-nowrap">
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: COLOR_ORIGEN[o] ?? "#8b7e66" }}
              />
              {o}
              {i < origenes.length - 1 ? "" : ""}
            </span>
          ))}
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visible.map((v) => {
          const hs = horasDesde(v.ultimoCambio);
          const limite = limiteDe(v);
          const vencido = hs > limite;
          const est = estatus(v);
          const tel = digitos(v.telefono);
          return (
            <article
              key={v.id}
              className="rounded-2xl border border-sand/60 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-black text-navy">
                    {v.nombre} {v.apellido}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-black tracking-[0.06em] uppercase ${
                        est.vencido
                          ? "border-wine/20 bg-wine/10 text-wine"
                          : "border-navy/20 bg-navy/5 text-navy"
                      }`}
                    >
                      {est.texto}
                    </span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                    {v.origen && (
                      <span
                        className="rounded-full px-2 py-0.5 font-bold text-white"
                        style={{
                          backgroundColor: COLOR_ORIGEN[v.origen] ?? "#8b7e66",
                        }}
                      >
                        {v.origen}
                      </span>
                    )}
                    <span>{v.zona}</span>
                    {!vencido && <span>· {hs}h desde asignación</span>}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold tracking-[0.06em] text-zinc-400 uppercase">
                    Contacto
                  </p>
                  <p className="font-bold text-navy">
                    {v.telefono ? formatearTelefono(v.telefono) : "—"}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {tel ? (
                  <a
                    href={`tel:${tel}`}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-sand bg-white text-[12px] font-black tracking-wide text-navy uppercase transition-all hover:bg-paper"
                  >
                    <Icono className="h-4 w-4">{I.telefono}</Icono>
                    Llamar
                  </a>
                ) : (
                  <span className="flex min-h-[44px] items-center justify-center rounded-xl border border-sand bg-paper text-[12px] font-black tracking-wide text-zinc-400 uppercase">
                    Sin teléfono
                  </span>
                )}
                {tel ? (
                  <a
                    href={`https://wa.me/${tel}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-sand bg-white text-[12px] font-black tracking-wide text-navy uppercase transition-all hover:bg-paper"
                  >
                    WhatsApp
                  </a>
                ) : (
                  <span className="flex min-h-[44px] items-center justify-center rounded-xl border border-sand bg-paper text-[12px] font-black tracking-wide text-zinc-400 uppercase">
                    Sin WhatsApp
                  </span>
                )}
                <button
                  disabled
                  title="Próximamente"
                  className="min-h-[44px] cursor-not-allowed rounded-xl bg-grape px-2 text-[12px] font-black tracking-wide text-white uppercase opacity-80"
                >
                  Coordinar visita
                </button>
                <button
                  onClick={() => abrirReporte(v)}
                  title={esReportado(v) ? "Reportar avance o visita" : "Confirmar el contacto con su fecha"}
                  className="min-h-[44px] cursor-pointer rounded-xl bg-gold px-2 text-[12px] font-black tracking-wide text-white uppercase transition-all hover:brightness-95"
                >
                  {v.estadoActual === "VISITA_AMISTAD"
                    ? "Reportar visita"
                    : esReportado(v)
                      ? "Editar reporte"
                      : "Llenar reporte"}
                </button>
              </div>
              {vencido && (
                <p
                  role="alert"
                  className="mt-2 rounded-xl bg-wine px-3 py-2 text-center text-[12px] font-bold text-white"
                >
                  Más de {limite}h sin avance · Prioridad alta
                </p>
              )}
            </article>
          );
        })}
      </div>
      {visible.length === 0 && (
        <p className="mt-3 rounded-2xl border border-dashed border-sand bg-white/60 px-6 py-8 text-center text-sm text-zinc-500">
          Nada aquí todavía.
        </p>
      )}

      {reporteDe && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Llenar reporte"
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-4 sm:items-center"
          onClick={() => setReporteId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-black text-navy">
              Reporte: {reporteDe.nombre} {reporteDe.apellido}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Avanza a{" "}
              <strong>{SIGUIENTE[reporteDe.estadoActual]?.etiqueta}</strong>{" "}
              con su fecha de contacto. Queda en el historial.
            </p>
            <label className="mt-3 block text-xs font-bold text-navy">
              Fecha del contacto
              <input
                type="datetime-local"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-sand bg-white px-4 text-sm text-navy outline-none"
                value={fechaContacto}
                onChange={(e) => setFechaContacto(e.target.value)}
                required
              />
            </label>
            <label className="mt-2 block text-xs font-bold text-navy">
              Observaciones del reporte
              <input
                className="mt-1 min-h-[44px] w-full rounded-xl border border-sand bg-white px-4 text-sm text-navy outline-none"
                placeholder="Cómo fue el contacto…"
                value={obsReporte}
                onChange={(e) => setObsReporte(e.target.value)}
              />
            </label>
            {errorReporte && (
              <p role="alert" className="mt-2 text-sm font-semibold text-wine">
                {errorReporte}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={guardarReporte}
                disabled={guardandoReporte}
                className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-gold px-4 text-sm font-black text-white uppercase disabled:opacity-60"
              >
                {guardandoReporte ? "Guardando…" : "Guardar reporte"}
              </button>
              <button
                onClick={() => setReporteId(null)}
                className="min-h-[44px] cursor-pointer rounded-xl border border-sand bg-white px-4 text-sm font-bold text-navy"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
