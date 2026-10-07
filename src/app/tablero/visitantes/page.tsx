"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ETIQUETA_ROL, I, Icono, Vacio, useTablero } from "../ui";
import { formatearTelefono, soloDigitos, enlaceLlamar, enlaceWhatsApp } from "@/lib/telefono";
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
type Raso = { id: string; nombre: string; apellido: string; grupoId: string | null; redId?: string | null; rol?: string };

// Punto medio del rango de edad de la ficha de primera visita.
const EDAD_MEDIA: Record<string, string> = {
  "14-18": "16",
  "18-26": "22",
  "26-40": "33",
  "40-50": "45",
  "50-60": "55",
  "60+": "65",
};

type Lectura = {
  key: number;
  nombre: string;
  apellido: string;
  zona: string;
  telefono: string;
  edad: string;
  codigoPostal: string;
  peticiones: string;
  observaciones: string;
  sinContacto: boolean;
  redId: string;
  grupoId: string;
  consolidadorId: string;
  confianza: number | null;
  creada: boolean;
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
  // Enlace profundo desde Equipo/Usuarios: ?consolidador=<id> filtra por
  // esa persona y muestra su información (validado como en el servidor).
  const paramConso = qp.get("consolidador");
  const [paramAplicado, setParamAplicado] = useState<string | null>(null);
  const esGestorUi =
    sesion?.rol === "PASTOR" || sesion?.rol === "LIDER_CONSOLIDADOR";
  const veTabSinAsignar =
    esGestorUi || sesion?.rol === "SUPERADMIN";

  const [busqueda, setBusqueda] = useState("");
  const [tab, setTab] = useState<
    "todos" | "alDia" | "pendientes" | "sinAsignar"
  >(qp.get("sinAsignar") === "1" ? "sinAsignar" : "todos");
  const [ahora] = useState(() => Date.now());
  const [lista, setLista] = useState<Visitante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [origenes, setOrigenes] = useState<Origen[]>([]);

  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(VACIO_FORM);
  // Importar fichas (foto/PDF): solo pre-rellena, nunca guarda solo.
  // Pueden ser varias por captura: cada lectura se revisa y crea aparte.
  const [panelImp, setPanelImp] = useState(false);
  const [archivosImp, setArchivosImp] = useState<File[]>([]);
  const [iglesiaImp, setIglesiaImp] = useState("");
  const [leyendo, setLeyendo] = useState("");
  const [lecturas, setLecturas] = useState<Lectura[]>([]);
  const [errorImp, setErrorImp] = useState("");
  const [creandoImp, setCreandoImp] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Asignación explícita (pastor/líder consolidador): red/grupo/consolidador
  // sin abrir el formulario completo. El estado se cambia con Reporte.
  const [asignandoId, setAsignandoId] = useState<string | null>(null);
  const [aRed, setARed] = useState("");
  const [aGrupo, setAGrupo] = useState("");
  const [aConso, setAConso] = useState("");
  // Reporte de avance del gestor (misma regla que el consolidador).
  const [reporteId, setReporteId] = useState<string | null>(null);
  const [repFecha, setRepFecha] = useState("");
  const [repObs, setRepObs] = useState("");
  const [repError, setRepError] = useState("");
  const [repGuardando, setRepGuardando] = useState(false);

  // Opciones del formulario (redes/grupos/rasos de la iglesia elegida).
  const [fRedes, setFRedes] = useState<Opcion[]>([]);
  const [fGrupos, setFGrupos] = useState<Opcion[]>([]);
  const [fRasos, setFRasos] = useState<Raso[]>([]);
  const [fOrigenes, setFOrigenes] = useState<Origen[]>([]);

  const soloSinAsignar = tab === "sinAsignar";

  async function recargar() {
    const qs = new URLSearchParams();
    if (iglesiaId) qs.set("iglesiaId", iglesiaId);
    if (soloSinAsignar) {
      qs.set("sinAsignar", "1");
    } else {
      // El tab Todos une asignados y no asignados.
      if (tab === "todos") qs.set("todos", "1");
      if (red !== "todas") qs.set("redId", red);
      if (grupo !== "todos") qs.set("grupoId", grupo);
      if (consolidador !== "todos") qs.set("consolidadorId", consolidador);
    }
    if (busqueda.trim()) qs.set("q", busqueda.trim());
    const r = await fetch(`/api/visitantes?${qs.toString()}`);
    if (r.ok) setLista(await r.json());
    setCargando(false);
  }

  useEffect(() => {
    const t = setTimeout(() => void recargar(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iglesiaId, red, grupo, consolidador, busqueda, tab]);

  // Aplica ?consolidador=<id> una vez haya resumen (misma regla que la
  // API: fuera de alcance se ignora sin ampliar nada).
  /* eslint-disable react-hooks/set-state-in-effect -- enlace profundo desde Equipo/Usuarios */
  useEffect(() => {
    if (!paramConso || paramAplicado || !resumen || !sesion) return;
    if (tab === "sinAsignar") return;
    const c = (resumen.consolidadores ?? []).find((x) => x.id === paramConso);
    if (!c) return;
    if (sesion.rol === "CONSOLIDADOR") {
      if (paramConso !== sesion.sub) return;
    } else if (sesion.rol === "LIDER_GRUPO") {
      if (!sesion.grupoId || c.grupoId !== sesion.grupoId) return;
    } else if (sesion.rol === "LIDER_RED") {
      if (!c.grupoId) return;
      const g = (resumen.grupos ?? []).find((x) => x.id === c.grupoId);
      if (!g || g.redId !== sesion.redId) return;
    }
    if (grupo !== "todos" && c.grupoId !== grupo) return;
    if (red !== "todas") {
      const g = c.grupoId
        ? (resumen.grupos ?? []).find((x) => x.id === c.grupoId)
        : undefined;
      if (!g || g.redId !== red) return;
    }
    setConsolidador(paramConso);
    setParamAplicado(paramConso);
  }, [paramConso, paramAplicado, resumen, sesion, red, grupo, tab, setConsolidador]);

  // Si el filtro se cambia a mano, el parámetro deja de mandar.
  useEffect(() => {
    if (!paramAplicado || consolidador === paramAplicado) return;
    setParamAplicado(null);
    const qs = new URLSearchParams();
    const e = qp.get("estado");
    const s = qp.get("sinAsignar");
    if (e) qs.set("estado", e);
    if (s) qs.set("sinAsignar", s);
    router.replace(
      qs.toString() ? `/tablero/visitantes?${qs}` : "/tablero/visitantes"
    );
  }, [paramAplicado, consolidador, qp, router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Información de la persona filtrada (datos ya visibles en el alcance).
  const infoConso =
    paramAplicado && consolidador === paramAplicado
      ? (resumen?.consolidadores ?? []).find((x) => x.id === paramAplicado)
      : undefined;
  const grupoConso = infoConso?.grupoId
    ? (resumen?.grupos ?? []).find((g) => g.id === infoConso.grupoId)
    : undefined;
  const redConso = grupoConso
    ? (resumen?.redes ?? []).find((r) => r.id === grupoConso.redId)
    : undefined;
  const iglesiaConso = grupoConso
    ? iglesias.find((i) => i.id === grupoConso.iglesiaId)
    : (iglesiaId ? iglesias.find((i) => i.id === iglesiaId) : undefined);
  const bannerConso = infoConso ? (
    <section
      aria-label={`Visitantes de ${infoConso.nombre} ${infoConso.apellido}`}
      className="rounded-2xl border border-navy/20 bg-navy/[0.04] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-lg font-black text-white">
            {infoConso.nombre.charAt(0).toUpperCase()}
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-black text-navy">
              {infoConso.nombre} {infoConso.apellido}{" "}
              <span className="ml-1 rounded-full border border-navy/20 bg-navy/5 px-2 py-0.5 align-middle text-[10px] font-black tracking-[0.06em]">
                {ETIQUETA_ROL[infoConso.rol as keyof typeof ETIQUETA_ROL] ?? infoConso.rol}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {[grupoConso?.nombre, redConso?.nombre, iglesiaConso?.nombre]
                .filter(Boolean)
                .join(" • ")}
              {` • ${infoConso.total} asignado(s)`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setConsolidador("todos")}
          title="Quitar filtro de persona"
          className="min-h-[40px] cursor-pointer rounded-full border border-navy/30 bg-white px-4 text-xs font-black tracking-wide text-navy uppercase hover:border-navy/60"
        >
          Quitar ✕
        </button>
      </div>
    </section>
  ) : null;

  function elegirTab(id: "todos" | "alDia" | "pendientes" | "sinAsignar") {
    setTab(id);
    if (id === "sinAsignar") {
      // El tab ignora la cascada: se vuelve a "todas/todos".
      setRed("todas");
      setGrupo("todos");
      setConsolidador("todos");
    }
  }

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
    // Precarga con los filtros activos (de lo más específico a lo general)
    // para no asignar en un lugar distinto al filtrado.
    let ig = iglesiaId || iglesias[0]?.id || "";
    let redSel = red !== "todas" ? red : "";
    let grupoSel = grupo !== "todos" ? grupo : "";
    const consoSel = consolidador !== "todos" ? consolidador : "";
    if (consoSel && !grupoSel) {
      const c = resumen?.consolidadores.find((x) => x.id === consoSel);
      if (c?.grupoId) grupoSel = c.grupoId;
    }
    if (grupoSel) {
      const g = resumen?.grupos.find((x) => x.id === grupoSel);
      if (g) {
        ig = g.iglesiaId;
        redSel = g.redId;
      }
    } else if (redSel) {
      const r = resumen?.redes.find((x) => x.id === redSel);
      if (r) ig = r.iglesiaId;
    }
    setForm({
      ...VACIO_FORM,
      iglesiaId: ig,
      redId: redSel,
      grupoId: grupoSel,
      consolidadorId: consoSel,
    });
    setError("");
    setCreando(true);
    void cargarOpciones(ig, redSel);
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

  function abrirAsignar(v: Visitante) {
    setAsignandoId(asignandoId === v.id ? null : v.id);
    setEditandoId(null);
    setReporteId(null);
    setARed(v.redId ?? "");
    setAGrupo(v.grupoId ?? "");
    setAConso(v.consolidadorId ?? "");
    setError("");
    void cargarOpciones(v.iglesiaId, v.redId ?? "");
  }

  async function guardarAsignacion(id: string) {
    setError("");
    setGuardando(true);
    const r = await fetch(`/api/visitantes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redId: aRed || null,
        grupoId: aGrupo || null,
        consolidadorId: aConso || null,
      }),
    });
    setGuardando(false);
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      setError(j?.error ?? "No se pudo asignar");
      return;
    }
    setAsignandoId(null);
    await recargar();
  }

  function abrirReporte(v: Visitante) {
    setReporteId(reporteId === v.id ? null : v.id);
    setAsignandoId(null);
    setEditandoId(null);
    setRepFecha(ahoraLocal());
    setRepObs("");
    setRepError("");
  }

  async function guardarReporte(id: string) {
    const v = lista.find((x) => x.id === id);
    if (!v) return;
    setRepError("");
    setRepGuardando(true);
    const r = await fetch(`/api/visitantes/${id}/reporte`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aEstado: SIGUIENTE[v.estadoActual]?.estado ?? v.estadoActual,
        fechaContacto: repFecha ? new Date(repFecha).toISOString() : null,
        observaciones: repObs || null,
      }),
    });
    setRepGuardando(false);
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      setRepError(j?.error ?? "No se pudo guardar el reporte");
      return;
    }
    setReporteId(null);
    await recargar();
  }

  function abrirImportar() {
    setPanelImp(!panelImp);
    setErrorImp("");
    // Iglesia por defecto: la del líder si es una sola; con más de una se
    // exige elegir (se pregunta, no se adivina).
    if (!panelImp && !iglesiaImp && iglesias.length === 1) {
      setIglesiaImp(iglesias[0].id);
      void cargarOpciones(iglesias[0].id, "");
    }
  }

  function archivoAImagen(file: File): Promise<{ mime: string; base64: string }> {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const data = c.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "";
        res({ mime: "image/jpeg", base64: data });
      };
      img.onerror = () => rej(new Error("imagen"));
      img.src = url;
    });
  }

  async function leerFichas() {
    if (archivosImp.length === 0 || archivosImp.length > 5) {
      setErrorImp("Elige de 1 a 5 fotos");
      return;
    }
    if (!iglesiaImp) {
      setErrorImp("Elige la iglesia de estos visitantes");
      return;
    }
    setErrorImp("");
    setLecturas([]);
    // Rasteriza en el cliente (solo fotos).
    setLeyendo("Preparando imágenes…");
    const imgs: { mime: string; base64: string }[] = [];
    try {
      for (const f of archivosImp) {
        if (f.type === "application/pdf") {
          setErrorImp("Solo fotos (el PDF llegó por error y no se acepta)");
          setLeyendo("");
          return;
        }
        imgs.push(await archivoAImagen(f));
      }
    } catch {
      setErrorImp("No se pudieron leer los archivos");
      setLeyendo("");
      return;
    }
    if (imgs.length === 0) {
      setErrorImp("Sin páginas para leer");
      setLeyendo("");
      return;
    }
    // De a 3 por pedido (evita tiempos largos en el servidor).
    const todas: Record<string, unknown>[] = [];
    try {
      for (let i = 0; i < imgs.length; i += 3) {
        setLeyendo(`Leyendo ${Math.min(i + 3, imgs.length)}/${imgs.length}…`);
        const r = await fetch("/api/visitantes/importar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenes: imgs.slice(i, i + 3) }),
        });
        const j = await r.json().catch(() => null);
        if (!r.ok) {
          setErrorImp(j?.error ?? "No se pudo leer");
          setLeyendo("");
          return;
        }
        todas.push(...((j?.lecturas ?? []) as Record<string, unknown>[]));
      }
    } finally {
      setLeyendo("");
    }
    if (todas.length === 0) {
      setErrorImp("No se detectó ninguna ficha completa");
      return;
    }
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    setLecturas(
      todas.map((l, idx) => {
        const sin =
          (l.aceptaComunicaciones as boolean | null) === false ||
          (l.aceptaWhatsapp as boolean | null) === false;
        return {
          key: Date.now() + idx,
          nombre: str(l.nombre),
          apellido: str(l.apellido),
          zona: str(l.zona),
          telefono: (str(l.telefono) || "").replace(/\D/g, "").slice(-9),
          edad: EDAD_MEDIA[str(l.rangoEdad)] ?? "",
          codigoPostal: str(l.codigoPostal),
          peticiones: Array.isArray(l.ayudas) ? (l.ayudas as string[]).join("; ") : "",
          observaciones: sin ? "⛔ No acepta comunicaciones/WhatsApp (ficha). " : "",
          sinContacto: sin,
          redId: "",
          grupoId: "",
          consolidadorId: "",
          confianza: typeof l.confianza === "number" ? l.confianza : null,
          creada: false,
        };
      })
    );
    void cargarOpciones(iglesiaImp, "");
  }

  function setLectura(key: number, campo: string, valor: string | boolean) {
    setLecturas((ls) => ls.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }

  async function crearDesdeLectura(l: Lectura) {
    if (l.creada) return;
    if (!l.nombre || !l.apellido || !l.zona || !iglesiaImp) {
      setErrorImp("Nombre, apellido, zona e iglesia son obligatorios");
      return;
    }
    // Mismo teléfono no se guarda dos veces: avisa antes de pedir al servidor.
    const tel = (l.telefono || "").replace(/\D/g, "");
    if (tel) {
      const enLista = lista.find((v) => (v.telefono ?? "").replace(/\D/g, "") === tel);
      if (enLista) {
        setErrorImp(`Ya existe ${enLista.nombre} ${enLista.apellido} con ese teléfono`);
        return;
      }
      const enLote = lecturas.find((x) => x.key !== l.key && (x.telefono || "").replace(/\D/g, "") === tel);
      if (enLote) {
        setErrorImp(`Ese teléfono ya está en otra ficha del lote (${enLote.nombre} ${enLote.apellido})`);
        return;
      }
    }
    setErrorImp("");
    setCreandoImp(true);
    // Origen por defecto: 1ra visita iglesia (la ficha es de primera visita).
    const origenDef = origenes.find((o) => o.nombre === "1ra visita iglesia")?.id ?? null;
    const r = await fetch("/api/visitantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: l.nombre,
        apellido: l.apellido,
        zona: l.zona,
        telefono: l.telefono || null,
        edad: l.edad ? Number(l.edad) : null,
        codigoPostal: l.codigoPostal || null,
        peticiones: l.peticiones || null,
        observaciones: l.observaciones || null,
        origenId: origenDef,
        iglesiaId: iglesiaImp,
        redId: l.redId || null,
        grupoId: l.grupoId || null,
        consolidadorId: l.consolidadorId || null,
        sinContacto: l.sinContacto,
      }),
    });
    setCreandoImp(false);
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      setErrorImp(j?.error ?? "No se pudo crear");
      return;
    }
    setLecturas((ls) => ls.map((x) => (x.key === l.key ? { ...x, creada: true } : x)));
    await recargar();
  }

  // Cascada del panel Asignar: red → grupo (solo de esa red) →
  // consolidador (solo de ese grupo).
  const gruposAsignar = aRed
    ? (fGrupos as (Opcion & { redId: string })[]).filter(
        (g) => g.redId === aRed
      )
    : [];
  // Nivel iglesia (sin grupo) solo sin filtro: con red o grupo elegidos
  // se oculta del desplegable.
  const asignarRasos = fRasos.filter((r) => {
    if (aGrupo) return r.grupoId === aGrupo;
    if (aRed) {
      const deLaRed = new Set(gruposAsignar.map((g) => g.id));
      return r.grupoId !== null && deLaRed.has(r.grupoId);
    }
    return true;
  });

  const iglesia = iglesias.find((i) => i.id === iglesiaId);
  // Cascada del formulario: con grupo, solo sus rasos; con red (sin
  // grupo), solo los de esa red. Nivel iglesia solo sin filtro.
  const rasosFiltrados = fRasos.filter((r) => {
    if (form.grupoId) return r.grupoId === form.grupoId;
    if (form.redId) {
      const gruposDeLaRed = new Set(fGrupos.map((g) => g.id));
      return r.grupoId !== null && gruposDeLaRed.has(r.grupoId);
    }
    return true;
  });
  const etiquetaRol = (rol?: string) =>
    rol === "LIDER_RED" ? " · líder red" : rol === "LIDER_GRUPO" ? " · líder grupo" : rol === "LIDER_CONSOLIDADOR" ? " · líder consolidador" : "";

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
            <option key={r.id} value={r.id}>{r.nombre} {r.apellido}{etiquetaRol(r.rol)}</option>
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
      <>
        {bannerConso}
        <VistaConsolidador
          key={estadoFiltro ?? "todos"}
          lista={lista}
          alertas={resumen?.alertas ?? []}
          estadoInicial={estadoFiltro}
          onCambio={recargar}
        />
      </>
    );
  }

  if (sesion?.rol === "LIDER_GRUPO" || sesion?.rol === "LIDER_RED") {
    return (
      <>
        {bannerConso}
        <VistaLiderGrupo
          lista={lista}
          alertas={resumen?.alertas ?? []}
          estadoInicial={estadoFiltro}
          esLiderRed={sesion.rol === "LIDER_RED"}
        />
      </>
    );
  }

  function horasDesde(iso: string) {
    return Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 3600000));
  }

  function limiteDe(v: Visitante) {
    return (
      resumen?.alertas.find(
        (a) => a.iglesiaId === v.iglesiaId && a.estado === v.estadoActual
      )?.maxHoras ?? 100
    );
  }

  const esPendiente = (v: Visitante) =>
    horasDesde(v.ultimoCambio) > limiteDe(v);

  const listaFiltrada = lista.filter((v) => {
    if (estadoFiltro && v.estadoActual !== estadoFiltro) return false;
    if (tab === "pendientes") return esPendiente(v);
    if (tab === "alDia") return !esPendiente(v);
    return true;
  });
  const etiquetaFiltro = estadoFiltro
    ? (INSIGNIA_ESTADO[estadoFiltro]?.texto ?? estadoFiltro)
    : null;
  // El tab Todos une asignados y no asignados; los contadores al
  // día/pendientes siguen sobre asignados (como las tarjetas).
  const asignados = lista.filter(
    (v) => v.redId || v.grupoId || v.consolidadorId
  );
  const alDia = asignados.filter((v) => !esPendiente(v)).length;
  const pendientes = asignados.length - alDia;

  return (
    <>
      {bannerConso}
      <section className="rounded-2xl border border-sand/60 bg-white p-4">      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
            <Icono className="h-5 w-5">{I.visitantes}</Icono>
          </span>
          <div className="leading-tight">
            <h2 className="text-[15px] font-black text-navy">
              {soloSinAsignar ? "No asignados" : "Visitantes"} •{" "}
              {listaFiltrada.length}
            </h2>
            <p className="text-xs text-zinc-500">
              {soloSinAsignar
                ? "Solo iglesia por asignar o 1er contacto sin consolidador · Reasigna con Asignar"
                : `Iglesia: ${iglesia ? iglesia.nombre : "Todas"}`}
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
          {esGestorUi && (
            <button
              onClick={abrirImportar}
              title="Leer fichas de primera visita (foto) y pre-rellenar"
              className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-navy/30 bg-white px-5 text-sm font-black tracking-wide text-navy uppercase transition-all hover:bg-paper"
            >
              <Icono className="h-4 w-4">{I.mas}</Icono>
              Importar
            </button>
          )}
        </div>
      </div>

      {esGestorUi && creando && bloqueForm(false)}

      {esGestorUi && panelImp && (
        <div className="mt-3 rounded-xl border border-sand/60 bg-paper p-3">
          <p className="text-xs font-bold text-navy">
            Importar fichas <span className="font-medium text-zinc-500">· foto obligatoria (máx 5) · solo pre-rellena, nada se guarda solo</span>
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
            <select aria-label="Iglesia de los importados" className={`${campo} cursor-pointer md:col-span-2`} value={iglesiaImp} required onChange={(e) => { setIglesiaImp(e.target.value); setLecturas([]); if (e.target.value) void cargarOpciones(e.target.value, ""); }}>
              <option value="">{iglesias.length > 1 ? "Elige la iglesia*…" : "Iglesia*…"}</option>
              {iglesias.map((ig) => (
                <option key={ig.id} value={ig.id}>{ig.nombre}</option>
              ))}
            </select>
            <label className={`${campo} flex cursor-pointer items-center justify-center gap-2 text-center`}>
              <Icono className="h-4 w-4">{I.mas}</Icono>
              {archivosImp.length > 0 ? `${archivosImp.length} foto(s)` : "Fotos (máx 5)…"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setArchivosImp(Array.from(e.target.files ?? []).slice(0, 5))}
              />
            </label>
            <button
              onClick={leerFichas}
              disabled={!!leyendo}
              className="min-h-[44px] cursor-pointer rounded-xl bg-navy px-4 text-sm font-black text-white uppercase disabled:opacity-60"
            >
              {leyendo ? "Leyendo…" : "Leer"}
            </button>
          </div>
          {leyendo && <p className="mt-2 text-xs font-semibold text-navy">{leyendo}</p>}
          {errorImp && (
            <p role="alert" className="mt-2 text-sm font-semibold text-wine">
              {errorImp}
            </p>
          )}
          {lecturas.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Revisa cada ficha, corrige lo mal leído y pulsa Crear. Lo dudoso viene vacío.
            </p>
          )}
          <ul className="mt-2 space-y-2">
            {lecturas.map((l) => (
              <li key={l.key} className="grid grid-cols-1 gap-2 rounded-xl border border-sand bg-white p-3 md:grid-cols-3">
                <p className="text-xs font-bold text-navy md:col-span-3">
                  Ficha leída
                  {l.confianza !== null && <span className="font-medium text-zinc-500"> · confianza {Math.round(l.confianza * 100)}%</span>}
                  {l.creada && <span className="ml-2 rounded-full bg-[#1F7A4B]/10 px-2 py-0.5 text-[#1F7A4B]">Creado</span>}
                </p>
                {l.sinContacto && (
                  <p role="alert" className="rounded-xl bg-wine px-3 py-2 text-center text-[12px] font-bold text-white md:col-span-3">
                    ⛔ Sin consentimiento: no recibirá mensajes ni grupos
                  </p>
                )}
                <input aria-label="Nombre" className={campo} placeholder="Nombre*" value={l.nombre} disabled={l.creada} onChange={(e) => setLectura(l.key, "nombre", e.target.value)} />
                <input aria-label="Apellido" className={campo} placeholder="Apellido*" value={l.apellido} disabled={l.creada} onChange={(e) => setLectura(l.key, "apellido", e.target.value)} />
                <input aria-label="Zona" className={campo} placeholder="Zona*" value={l.zona} disabled={l.creada} onChange={(e) => setLectura(l.key, "zona", e.target.value)} />
                <input aria-label="Teléfono" className={campo} placeholder="Teléfono" inputMode="numeric" value={formatearTelefono(l.telefono)} disabled={l.creada} onChange={(e) => setLectura(l.key, "telefono", soloDigitos(e.target.value).slice(-9))} />
                <input aria-label="Edad" className={campo} placeholder="Edad" inputMode="numeric" value={l.edad} disabled={l.creada} onChange={(e) => setLectura(l.key, "edad", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                <input aria-label="Código postal" className={campo} placeholder="Código postal" value={l.codigoPostal} disabled={l.creada} onChange={(e) => setLectura(l.key, "codigoPostal", e.target.value)} />
                <select aria-label="Red" className={`${campo} cursor-pointer`} value={l.redId} disabled={l.creada} onChange={(e) => { setLectura(l.key, "redId", e.target.value); setLectura(l.key, "grupoId", ""); setLectura(l.key, "consolidadorId", ""); void cargarOpciones(iglesiaImp, e.target.value); }}>
                  <option value="">Red…</option>
                  {fRedes.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
                <select aria-label="Grupo" className={`${campo} cursor-pointer`} value={l.grupoId} disabled={l.creada} onChange={(e) => { setLectura(l.key, "grupoId", e.target.value); setLectura(l.key, "consolidadorId", ""); }}>
                  <option value="">Grupo…</option>
                  {fGrupos.map((g) => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
                <select aria-label="Consolidador" className={`${campo} cursor-pointer`} value={l.consolidadorId} disabled={l.creada} onChange={(e) => setLectura(l.key, "consolidadorId", e.target.value)}>
                  <option value="">Consolidador…</option>
                  {rasosFiltrados.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre} {r.apellido}{etiquetaRol(r.rol)}</option>
                  ))}
                </select>
                <input aria-label="Peticiones" className={`${campo} md:col-span-2`} placeholder="Peticiones" value={l.peticiones} disabled={l.creada} onChange={(e) => setLectura(l.key, "peticiones", e.target.value)} />
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-semibold text-navy">
                  <input type="checkbox" checked={l.sinContacto} disabled={l.creada} onChange={(e) => setLectura(l.key, "sinContacto", e.target.checked)} className="h-5 w-5 accent-[#A91E32]" />
                  Sin contacto
                </label>
                <input aria-label="Observaciones" className={`${campo} md:col-span-3`} placeholder="Observaciones" value={l.observaciones} disabled={l.creada} onChange={(e) => setLectura(l.key, "observaciones", e.target.value)} />
                {!l.creada && (
                  <div className="flex gap-2 md:col-span-3">
                    <button onClick={() => crearDesdeLectura(l)} disabled={creandoImp} className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-navy px-4 text-sm font-black text-white uppercase disabled:opacity-60">
                      {creandoImp ? "Creando…" : "Crear visitante"}
                    </button>
                    <button onClick={() => setLecturas((ls) => ls.filter((x) => x.key !== l.key))} className="min-h-[44px] cursor-pointer rounded-xl border border-sand bg-white px-4 text-sm font-bold text-navy">
                      Descartar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrar visitantes">
          {(
            [
              { id: "todos", texto: "Todos" },
              { id: "alDia", texto: "Al día" },
              { id: "pendientes", texto: "Pendientes" },
              ...(veTabSinAsignar
                ? [{ id: "sinAsignar", texto: "No asignados" } as const]
                : []),
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={tab === p.id}
              onClick={() => elegirTab(p.id)}
              className={`min-h-[36px] cursor-pointer rounded-full px-4 text-[11px] font-black tracking-[0.06em] uppercase transition-all ${
                tab === p.id
                  ? "bg-navy text-white"
                  : "border border-sand bg-white text-zinc-500 hover:bg-paper"
              }`}
            >
              {p.texto}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          {alDia} al día · {pendientes} pendientes
        </p>
      </div>

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
                        {v.estadoActual === "PRIMER_CONTACTO" &&
                          !v.consolidadorId &&
                          (v.redId || v.grupoId) && (
                            <span className="rounded-full border border-wine/20 bg-wine/10 px-2 py-0.5 text-[10px] font-black tracking-[0.06em] text-wine uppercase">
                              No asignado 2do
                            </span>
                          )}
                        {!v.redId && !v.grupoId && !v.consolidadorId && (
                          <span className="rounded-full border border-wine/20 bg-wine/10 px-2 py-0.5 text-[10px] font-black tracking-[0.06em] text-wine uppercase">
                            Sin asignar
                          </span>
                        )}
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
                      {v.telefono && (
                        <>
                          <a
                            href={enlaceLlamar(v.telefono) ?? "#"}
                            title={`Llamar a ${v.nombre} ${v.apellido}`}
                            aria-label={`Llamar a ${v.nombre} ${v.apellido}`}
                            className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-lg border border-sand bg-white text-navy transition-all duration-200 hover:border-navy/30"
                          >
                            <Icono className="h-4 w-4">{I.telefono}</Icono>
                          </a>
                          <a
                            href={enlaceWhatsApp(v.telefono) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            title={`WhatsApp a ${v.nombre} ${v.apellido}`}
                            aria-label={`WhatsApp a ${v.nombre} ${v.apellido}`}
                            className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-lg border border-sand bg-white text-[#1F7A4B] transition-all duration-200 hover:border-[#1F7A4B]/40"
                          >
                            <Icono className="h-4 w-4">{I.whatsapp}</Icono>
                          </a>
                        </>
                      )}
                      <span className="rounded-full border border-sand bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600">
                        {new Date(v.fechaRegistro).toLocaleDateString("es-ES")}
                      </span>
                      {esGestorUi && (
                        <span className="flex flex-wrap gap-1">
                          <button
                            onClick={() => abrirAsignar(v)}
                            className="min-h-[40px] cursor-pointer rounded-lg px-2 text-[12px] font-bold text-navy/70 hover:underline"
                          >
                            {asignandoId === v.id ? "Cerrar" : "Asignar"}
                          </button>
                          <button
                            onClick={() => abrirReporte(v)}
                            className="min-h-[40px] cursor-pointer rounded-lg px-2 text-[12px] font-bold text-navy/70 hover:underline"
                          >
                            {reporteId === v.id ? "Cerrar" : "Reporte"}
                          </button>
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
                  {esGestorUi && asignandoId === v.id && (
                    <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-sand/60 bg-white p-3 md:grid-cols-4">
                      <p className="text-xs font-bold text-navy md:col-span-4">
                        Asignar a {v.nombre} {v.apellido} ·{" "}
                        <span className="font-medium text-zinc-500">
                          red, grupo y quién lo consolida (líderes incluidos)
                        </span>
                      </p>
                      <select aria-label="Red asignada" className={`${campo} cursor-pointer`} value={aRed} onChange={(e) => { setARed(e.target.value); setAGrupo(""); setAConso(""); void cargarOpciones(v.iglesiaId, e.target.value); }}>
                        <option value="">Red…</option>
                        {fRedes.map((r) => (
                          <option key={r.id} value={r.id}>{r.nombre}</option>
                        ))}
                      </select>
                      <select aria-label="Grupo asignado" className={`${campo} cursor-pointer`} value={aGrupo} disabled={!aRed} title={!aRed ? "Elige primero la red" : undefined} onChange={(e) => { setAGrupo(e.target.value); setAConso(""); }}>
                        <option value="">{aRed ? "Grupo…" : "Grupo (elige red)…"}</option>
                        {gruposAsignar.map((g) => (
                          <option key={g.id} value={g.id}>{g.nombre}</option>
                        ))}
                      </select>
                      <select aria-label="Consolidador asignado" className={`${campo} cursor-pointer`} value={aConso} disabled={!aGrupo} title={!aGrupo ? "Elige primero el grupo" : undefined} onChange={(e) => setAConso(e.target.value)}>
                        <option value="">{aGrupo ? "Consolidador…" : "Consolidador (elige grupo)…"}</option>
                        {asignarRasos.map((r) => (
                          <option key={r.id} value={r.id}>{r.nombre} {r.apellido}{etiquetaRol(r.rol)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => guardarAsignacion(v.id)}
                        disabled={guardando}
                        className="min-h-[44px] cursor-pointer rounded-xl bg-navy px-4 text-sm font-black text-white uppercase disabled:opacity-60"
                      >
                        {guardando ? "Guardando…" : "Guardar"}
                      </button>
                      {error && (
                        <p role="alert" className="text-sm font-semibold text-wine md:col-span-4">
                          {error}
                        </p>
                      )}
                    </div>
                  )}
                  {esGestorUi && reporteId === v.id && (
                    <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-sand/60 bg-white p-3 md:grid-cols-3">
                      <p className="text-xs font-bold text-navy md:col-span-3">
                        Reporte: avanza a{" "}
                        {SIGUIENTE[v.estadoActual]?.etiqueta} con su fecha de
                        contacto. Queda en el historial.
                      </p>
                      <input
                        aria-label="Fecha del contacto"
                        type="datetime-local"
                        className={campo}
                        value={repFecha}
                        onChange={(e) => setRepFecha(e.target.value)}
                        required
                      />
                      <input
                        aria-label="Observaciones del reporte"
                        className={`${campo} md:col-span-2`}
                        placeholder="Cómo fue el contacto…"
                        value={repObs}
                        onChange={(e) => setRepObs(e.target.value)}
                      />
                      <div className="flex gap-2 md:col-span-3">
                        <button
                          onClick={() => guardarReporte(v.id)}
                          disabled={repGuardando}
                          className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-gold px-4 text-sm font-black text-white uppercase disabled:opacity-60"
                        >
                          {repGuardando ? "Guardando…" : "Guardar reporte"}
                        </button>
                        <button
                          onClick={() => setReporteId(null)}
                          className="min-h-[44px] cursor-pointer rounded-xl border border-sand bg-white px-4 text-sm font-bold text-navy"
                        >
                          Cancelar
                        </button>
                      </div>
                      {repError && (
                        <p role="alert" className="text-sm font-semibold text-wine md:col-span-3">
                          {repError}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
    </>
  );
}

function VistaLiderGrupo({
  lista,
  alertas,
  estadoInicial = null,
  esLiderRed = false,
}: {
  lista: Visitante[];
  alertas: { iglesiaId: string; estado: string; maxHoras: number }[];
  estadoInicial?: string | null;
  esLiderRed?: boolean;
}) {
  const [estado, setEstado] = useState<string | null>(estadoInicial);
  const [filtro, setFiltro] = useState<"todos" | "pendientes" | "alDia">("todos");
  const [ahora] = useState(() => Date.now());

  function horasDesde(iso: string) {
    return Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 3600000));
  }

  function limiteDe(v: Visitante) {
    return (
      alertas.find(
        (a) => a.iglesiaId === v.iglesiaId && a.estado === v.estadoActual
      )?.maxHoras ?? 100
    );
  }

  function estatus(v: Visitante): { texto: string; vencido: boolean } {
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

  const esPendiente = (v: Visitante) => horasDesde(v.ultimoCambio) > limiteDe(v);

  const visible = lista.filter((v) => {
    if (estado && v.estadoActual !== estado) return false;
    if (filtro === "pendientes") return esPendiente(v);
    if (filtro === "alDia") return !esPendiente(v);
    return true;
  });

  const COLOR_ORIGEN: Record<string, string> = {
    Evangelismo: "#a91e32",
    "Operación Mateo 25": "#204b6e",
    "1ra visita grupo": "#c9a227",
    "1ra visita iglesia": "#4b306a",
  };

  return (
    <section className="rounded-2xl border border-sand/60 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
            <Icono className="h-5 w-5">{I.visitantes}</Icono>
          </span>
          <div className="leading-tight">
            <h2 className="text-[15px] font-black text-navy">
              {esLiderRed
                ? `Visitantes de tu red • ${visible.length}`
                : `Visitantes de tu grupo • ${visible.length}`}
            </h2>
            <p className="text-xs text-zinc-500">
              Solo lectura · Estado, origen y contacto
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="tablist" aria-label="Filtrar visitantes">
            {([
              { id: "todos", texto: "Todos" },
              { id: "alDia", texto: "Al día" },
              { id: "pendientes", texto: "Pendientes" },
            ] as const).map((p) => (
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
          {estado && (
            <button
              onClick={() => setEstado(null)}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-navy/30 bg-navy/5 px-3 text-xs font-black text-navy"
            >
              Quitar filtro ✕
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        {visible.length === 0 ? (
          <Vacio
            titulo="Sin visitantes en este filtro"
            detalle="Ajusta los filtros para ver visitantes de tu grupo."
          />
        ) : (
          <ul className="space-y-2">
            {visible.map((v) => {
              const hs = horasDesde(v.ultimoCambio);
              const limite = limiteDe(v);
              const vencido = hs > limite;
              const est = estatus(v);
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
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-black tracking-[0.06em] uppercase ${
                            est.vencido
                              ? "border-wine/20 bg-wine/10 text-wine"
                              : "border-navy/20 bg-navy/5 text-navy"
                          }`}
                        >
                          {est.texto}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {v.origen && (
                          <span
                            className="mr-1 inline-block rounded-full px-2 py-0.5 font-bold text-white"
                            style={{
                              backgroundColor: COLOR_ORIGEN[v.origen] ?? "#8b7e66",
                            }}
                          >
                            {v.origen}
                          </span>
                        )}
                        {v.zona}
                        {!vencido && <span>· {hs}h desde asignación</span>}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full border border-sand bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600">
                        {v.telefono ? formatearTelefono(v.telefono) : "—"}
                      </span>
                      {enlaceLlamar(v.telefono) ? (
                        <a
                          href={enlaceLlamar(v.telefono) as string}
                          title={`Llamar a ${v.nombre} ${v.apellido}`}
                          className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border border-sand bg-white px-3 text-[12px] font-black tracking-wide text-navy uppercase transition-all duration-200 hover:border-navy/30"
                        >
                          <Icono className="h-4 w-4">{I.telefono}</Icono>
                          Llamar
                        </a>
                      ) : (
                        <span className="flex min-h-[40px] cursor-not-allowed items-center gap-1.5 rounded-lg border border-sand bg-paper px-3 text-[12px] font-black tracking-wide text-zinc-400 uppercase">
                          <Icono className="h-4 w-4">{I.telefono}</Icono>
                          Llamar
                        </span>
                      )}
                      {enlaceWhatsApp(v.telefono) ? (
                        <a
                          href={enlaceWhatsApp(v.telefono) as string}
                          target="_blank"
                          rel="noreferrer"
                          title={`WhatsApp a ${v.nombre} ${v.apellido}`}
                          className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border border-sand bg-white px-3 text-[12px] font-black tracking-wide text-[#1F7A4B] uppercase transition-all duration-200 hover:border-[#1F7A4B]/40"
                        >
                          <Icono className="h-4 w-4">{I.whatsapp}</Icono>
                          WhatsApp
                        </a>
                      ) : (
                        <span className="flex min-h-[40px] cursor-not-allowed items-center gap-1.5 rounded-lg border border-sand bg-paper px-3 text-[12px] font-black tracking-wide text-zinc-400 uppercase">
                          WhatsApp
                        </span>
                      )}
                    </span>
                  </div>
                  {vencido && (
                    <p
                      role="alert"
                      className="mt-2 rounded-xl bg-wine px-3 py-2 text-center text-[12px] font-bold text-white"
                    >
                      Más de {limite}h sin avance · Prioridad alta
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
