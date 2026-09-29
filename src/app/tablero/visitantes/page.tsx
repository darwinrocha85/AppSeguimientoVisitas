"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { I, Icono, Vacio, useTablero } from "../ui";
import { formatearTelefono, soloDigitos } from "@/lib/telefono";
import { VistaConsolidador } from "./vista-consolidador";

type Visitante = {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  zona: string;
  edad?: number | null;
  codigoPostal?: string | null;
  calle?: string | null;
  invitadoPor?: string | null;
  peticiones?: string | null;
  observaciones?: string | null;
  estadoActual: string;
  origen: string | null;
  origenId?: string | null;
  iglesiaId: string;
  iglesia: string;
  redId?: string | null;
  grupoId?: string | null;
  red: string | null;
  grupo: string | null;
  consolidadorId?: string | null;
  consolidador: string | null;
  fechaRegistro: string;
  ultimoCambio: string;
};

type Origen = { id: string; nombre: string };
type Opcion = { id: string; nombre: string };
type Raso = { id: string; nombre: string; apellido: string; grupoId: string | null };

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

const campo =
  "min-h-[44px] rounded-xl border border-sand bg-white px-4 text-sm text-navy outline-none placeholder:text-[#B8A99A]/70 focus:border-navy/30 focus:ring-4 focus:ring-navy/[0.06]";

function iniciales(n: string, a: string) {
  return `${n.charAt(0)}${a.charAt(0)}`.toUpperCase();
}

const VACIO_FORM = {
  nombre: "",
  apellido: "",
  zona: "",
  telefono: "",
  edad: "",
  codigoPostal: "",
  calle: "",
  invitadoPor: "",
  peticiones: "",
  observaciones: "",
  origenId: "",
  iglesiaId: "",
  redId: "",
  grupoId: "",
  consolidadorId: "",
};

export default function Visitantes() {
  return (
    <Suspense
      fallback={
        <p className="text-sm font-semibold text-navy">Cargando visitantes…</p>
      }
    >
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const {
    iglesiaId,
    iglesias,
    red,
    grupo,
    consolidador,
    setIglesiaId,
    setRed,
    setGrupo,
    setConsolidador,
    sesion,
    resumen,
  } = useTablero();
  const qp = useSearchParams();
  const router = useRouter();
  const estadoFiltro = qp.get("estado");
  const esGestorUi =
    sesion?.rol === "PASTOR" || sesion?.rol === "LIDER_CONSOLIDADOR";

  const [busqueda, setBusqueda] = useState("");
  const [lista, setLista] = useState<Visitante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [origenes, setOrigenes] = useState<Origen[]>([]);

  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(VACIO_FORM);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Opciones del formulario (redes/grupos/rasos de la iglesia elegida).
  const [fRedes, setFRedes] = useState<Opcion[]>([]);
  const [fGrupos, setFGrupos] = useState<Opcion[]>([]);
  const [fRasos, setFRasos] = useState<Raso[]>([]);
  const [fOrigenes, setFOrigenes] = useState<Origen[]>([]);

  async function recargar() {
    const qs = new URLSearchParams();
    if (iglesiaId) qs.set("iglesiaId", iglesiaId);
    if (red !== "todas") qs.set("redId", red);
    if (grupo !== "todos") qs.set("grupoId", grupo);
    if (consolidador !== "todos") qs.set("consolidadorId", consolidador);
    if (busqueda.trim()) qs.set("q", busqueda.trim());
    const r = await fetch(`/api/visitantes?${qs.toString()}`);
    if (r.ok) setLista(await r.json());
    setCargando(false);
  }

  useEffect(() => {
    const t = setTimeout(() => void recargar(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iglesiaId, red, grupo, consolidador, busqueda]);

  useEffect(() => {
    async function catalogos() {
      const r = await fetch("/api/origenes");
      if (r.ok) {
        const o: Origen[] = await r.json();
        setOrigenes(o);
        setFOrigenes(o);
      }
    }
    void catalogos();
  }, []);

  async function cargarOpciones(iglesia: string, redSel: string) {
    if (!iglesia) {
      setFRedes([]);
      setFGrupos([]);
      setFRasos([]);
      return;
    }
    const [rr, rg, rs] = await Promise.all([
      fetch(`/api/redes?iglesiaId=${iglesia}`),
      fetch(`/api/grupos?iglesiaId=${iglesia}`),
      fetch(`/api/tablero/resumen?iglesiaId=${iglesia}`),
    ]);
    if (rr.ok) setFRedes(await rr.json());
    const gs: (Opcion & { redId: string })[] = rg.ok ? await rg.json() : [];
    setFGrupos(redSel ? gs.filter((g) => g.redId === redSel) : gs);
    if (rs.ok) {
      const j = await rs.json();
      setFRasos(j.consolidadores ?? []);
    }
  }

  function setF(k: string, v: string) {
    setForm((f) => {
      const n = { ...f, [k]: v };
      if (k === "iglesiaId") {
        n.redId = "";
        n.grupoId = "";
        n.consolidadorId = "";
        void cargarOpciones(v, "");
      }
      if (k === "redId") {
        n.grupoId = "";
        n.consolidadorId = "";
        void cargarOpciones(n.iglesiaId, v);
      }
      if (k === "grupoId") n.consolidadorId = "";
      return n;
    });
  }

  function abrirCrear() {
    const ig = iglesiaId || iglesias[0]?.id || "";
    setForm({ ...VACIO_FORM, iglesiaId: ig });
    setError("");
    setCreando(true);
    void cargarOpciones(ig, "");
  }

  function abrirEdicion(v: Visitante) {
    setForm({
      nombre: v.nombre,
      apellido: v.apellido,
      zona: v.zona,
      telefono: v.telefono ? soloDigitos(v.telefono) : "",
      edad: v.edad != null ? String(v.edad) : "",
      codigoPostal: v.codigoPostal ?? "",
      calle: v.calle ?? "",
      invitadoPor: v.invitadoPor ?? "",
      peticiones: v.peticiones ?? "",
      observaciones: v.observaciones ?? "",
      origenId: v.origenId ?? "",
      iglesiaId: v.iglesiaId,
      redId: v.redId ?? "",
      grupoId: v.grupoId ?? "",
      consolidadorId: v.consolidadorId ?? "",
    });
    setError("");
    setEditandoId(v.id);
    setCreando(false);
    void cargarOpciones(v.iglesiaId, v.redId ?? "");
  }

  function cuerpoForm() {
    return {
      nombre: form.nombre,
      apellido: form.apellido,
      zona: form.zona,
      telefono: form.telefono || null,
      edad: form.edad ? Number(form.edad) : null,
      codigoPostal: form.codigoPostal || null,
      calle: form.calle || null,
      invitadoPor: form.invitadoPor || null,
      peticiones: form.peticiones || null,
      observaciones: form.observaciones || null,
      origenId: form.origenId || null,
      iglesiaId: form.iglesiaId,
      redId: form.redId || null,
      grupoId: form.grupoId || null,
      consolidadorId: form.consolidadorId || null,
    };
  }

  async function guardar(e: React.FormEvent, id?: string) {
    e.preventDefault();
    if (!form.nombre || !form.apellido || !form.zona || !form.iglesiaId) {
      setError("Nombre, apellido, zona e iglesia son obligatorios");
      return;
    }
    setError("");
    setGuardando(true);
    const r = await fetch(id ? `/api/visitantes/${id}` : "/api/visitantes", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoForm()),
    });
    setGuardando(false);
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      setError(j?.error ?? "No se pudo guardar");
      return;
    }
    setCreando(false);
    setEditandoId(null);
    setForm(VACIO_FORM);
    await recargar();
  }

  async function eliminar(v: Visitante) {
    if (
      !window.confirm(
        `¿Desactivar a ${v.nombre} ${v.apellido}? Se conserva su historial.`
      )
    ) {
      return;
    }
    const r = await fetch(`/api/visitantes/${v.id}`, { method: "DELETE" });
    if (r.ok) await recargar();
    else setError("No se pudo desactivar");
  }

  const iglesia = iglesias.find((i) => i.id === iglesiaId);
  const rasosFiltrados = form.grupoId
    ? fRasos.filter((r) => r.grupoId === form.grupoId)
    : fRasos;

  function bloqueForm(esEdicion: boolean, id?: string) {
    return (
      <form
        onSubmit={(e) => guardar(e, id)}
        className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-sand/60 bg-paper p-3 md:grid-cols-3"
      >
        <input aria-label="Nombre" className={campo} placeholder="Nombre*" value={form.nombre} onChange={(e) => setF("nombre", e.target.value)} required />
        <input aria-label="Apellido" className={campo} placeholder="Apellido*" value={form.apellido} onChange={(e) => setF("apellido", e.target.value)} required />
        <input aria-label="Zona donde vive" className={campo} placeholder="Zona donde vive*" value={form.zona} onChange={(e) => setF("zona", e.target.value)} required />
        <input aria-label="Teléfono" className={campo} placeholder="Teléfono (607 35 00 44)" inputMode="numeric" value={formatearTelefono(form.telefono)} onChange={(e) => setF("telefono", soloDigitos(e.target.value))} />
        <input aria-label="Edad" className={campo} placeholder="Edad" inputMode="numeric" value={form.edad} onChange={(e) => setF("edad", e.target.value.replace(/\D/g, "").slice(0, 3))} />
        <input aria-label="Código postal" className={campo} placeholder="Código postal" value={form.codigoPostal} onChange={(e) => setF("codigoPostal", e.target.value)} />
        <input aria-label="Calle" className={`${campo} md:col-span-2`} placeholder="Calle" value={form.calle} onChange={(e) => setF("calle", e.target.value)} />
        <input aria-label="Quién lo invitó" className={campo} placeholder="Quién lo invitó" value={form.invitadoPor} onChange={(e) => setF("invitadoPor", e.target.value)} />
        <select aria-label="Origen" className={`${campo} cursor-pointer`} value={form.origenId} onChange={(e) => setF("origenId", e.target.value)}>
          <option value="">Origen…</option>
          {(esEdicion ? origenes : fOrigenes).map((o) => (
            <option key={o.id} value={o.id}>{o.nombre}</option>
          ))}
        </select>
        <select aria-label="Iglesia" className={`${campo} cursor-pointer`} value={form.iglesiaId} onChange={(e) => setF("iglesiaId", e.target.value)} required>
          <option value="">Iglesia*…</option>
          {iglesias.map((ig) => (
            <option key={ig.id} value={ig.id}>{ig.nombre}</option>
          ))}
        </select>
        <select aria-label="Red" className={`${campo} cursor-pointer`} value={form.redId} onChange={(e) => setF("redId", e.target.value)}>
          <option value="">Red…</option>
          {fRedes.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
        <select aria-label="Grupo" className={`${campo} cursor-pointer`} value={form.grupoId} onChange={(e) => setF("grupoId", e.target.value)}>
          <option value="">Grupo…</option>
          {fGrupos.map((g) => (
            <option key={g.id} value={g.id}>{g.nombre}</option>
          ))}
        </select>
        <select aria-label="Consolidador" className={`${campo} cursor-pointer`} value={form.consolidadorId} onChange={(e) => setF("consolidadorId", e.target.value)}>
          <option value="">Consolidador…</option>
          {rasosFiltrados.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre} {r.apellido}</option>
          ))}
        </select>
        <input aria-label="Peticiones de oración" className={`${campo} md:col-span-2`} placeholder="Peticiones de oración" value={form.peticiones} onChange={(e) => setF("peticiones", e.target.value)} />
        <input aria-label="Observaciones" className={campo} placeholder="Observaciones" value={form.observaciones} onChange={(e) => setF("observaciones", e.target.value)} />
        <div className="flex gap-2 md:col-span-3">
          <button
            disabled={guardando}
            className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-navy px-4 text-sm font-black text-white uppercase transition-all duration-200 hover:bg-navy-dark disabled:opacity-60"
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar" : "Registrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreando(false);
              setEditandoId(null);
              setForm(VACIO_FORM);
            }}
            className="min-h-[44px] cursor-pointer rounded-xl border border-sand bg-white px-4 text-sm font-bold text-navy"
          >
            Cancelar
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-wine md:col-span-3">
            {error}
          </p>
        )}
      </form>
    );
  }

  if (sesion?.rol === "CONSOLIDADOR") {
    return (
      <VistaConsolidador
        key={estadoFiltro ?? "todos"}
        lista={lista}
        alertas={resumen?.alertas ?? []}
        estadoInicial={estadoFiltro}
      />
    );
  }

  const listaFiltrada = estadoFiltro
    ? lista.filter((v) => v.estadoActual === estadoFiltro)
    : lista;
  const etiquetaFiltro = estadoFiltro
    ? (INSIGNIA_ESTADO[estadoFiltro]?.texto ?? estadoFiltro)
    : null;

  return (
    <section className="rounded-2xl border border-sand/60 bg-white p-4">      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
            <Icono className="h-5 w-5">{I.visitantes}</Icono>
          </span>
          <div className="leading-tight">
            <h2 className="text-[15px] font-black text-navy">
              Visitantes • {listaFiltrada.length}
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
          {esGestorUi ? (
            <button
              onClick={() => {
                setEditandoId(null);
                if (creando) setCreando(false);
                else abrirCrear();
              }}
              className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full bg-wine px-5 text-sm font-black tracking-wide text-white uppercase transition-all hover:bg-[#8A1830]"
            >
              <Icono className="h-4 w-4">{I.mas}</Icono>
              Nuevo
            </button>
          ) : (
            <button
              disabled
              title="Solo pastor o líder consolidador"
              className="flex min-h-[44px] cursor-not-allowed items-center gap-1.5 rounded-full bg-wine px-5 text-sm font-black tracking-wide text-white uppercase opacity-60"
            >
              <Icono className="h-4 w-4">{I.mas}</Icono>
              Nuevo
            </button>
          )}
        </div>
      </div>

      {esGestorUi && creando && bloqueForm(false)}

      {etiquetaFiltro && (
        <div className="mt-3">
          <button
            onClick={() => router.replace("/tablero/visitantes")}
            title="Quitar filtro"
            className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-navy/30 bg-navy/5 px-3 text-xs font-black text-navy"
          >
            Filtrado: {etiquetaFiltro} ✕
          </button>
        </div>
      )}

      <div className="mt-4">
        {cargando ? (
          <p className="py-6 text-center text-sm font-semibold text-navy">
            Cargando visitantes…
          </p>
        ) : listaFiltrada.length === 0 ? (
          <Vacio
            titulo="Sin visitantes en este filtro"
            detalle="Ajusta la iglesia o la búsqueda, o registra el primero."
          />
        ) : (
          <ul className="space-y-2">
            {listaFiltrada.map((v) => {
              const ins =
                INSIGNIA_ESTADO[v.estadoActual] ?? INSIGNIA_ESTADO.DESEA_SER_CONTACTADO;
              return (
                <li
                  key={v.id}
                  className="rounded-xl border border-sand/70 bg-paper p-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
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
                      {esGestorUi && (
                        <span className="flex gap-1">
                          <button
                            onClick={() =>
                              editandoId === v.id
                                ? setEditandoId(null)
                                : abrirEdicion(v)
                            }
                            className="min-h-[40px] cursor-pointer rounded-lg px-2 text-[12px] font-bold text-navy/70 hover:underline"
                          >
                            {editandoId === v.id ? "Cerrar" : "Editar"}
                          </button>
                          <button
                            onClick={() => eliminar(v)}
                            className="min-h-[40px] cursor-pointer rounded-lg px-2 text-[12px] font-bold text-wine/80 hover:underline"
                          >
                            Eliminar
                          </button>
                        </span>
                      )}
                    </span>
                  </div>
                  {esGestorUi && editandoId === v.id && bloqueForm(true, v.id)}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
