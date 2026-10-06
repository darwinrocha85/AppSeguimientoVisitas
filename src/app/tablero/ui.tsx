"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/* ---------- Tipos ---------- */

export type Rol =
  | "SUPERADMIN"
  | "PASTOR"
  | "LIDER_CONSOLIDADOR"
  | "LIDER_RED"
  | "LIDER_GRUPO"
  | "CONSOLIDADOR";

export type Sesion = {
  sub: string;
  usuario: string;
  nombre?: string;
  apellido?: string;
  rol: Rol;
  iglesias: string[];
  redId?: string | null;
  grupoId?: string | null;
};

export type Iglesia = {
  id: string;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  SUPERADMIN: "SUPER ADMIN",
  PASTOR: "PASTOR",
  LIDER_CONSOLIDADOR: "LÍDER CONSOLIDADOR",
  LIDER_RED: "LÍDER DE RED",
  LIDER_GRUPO: "LÍDER DE GRUPO",
  CONSOLIDADOR: "CONSOLIDADOR",
};

export type Resumen = {
  alcance: string;
  total: number;
  noAsignados: number;
  porEstado: Record<string, number>;
  porIglesia: { iglesiaId: string; nombre: string; total: number }[];
  redes: { id: string; nombre: string; iglesiaId: string; total: number }[];
  grupos: {
    id: string;
    nombre: string;
    iglesiaId: string;
    redId: string;
    total: number;
  }[];
  consolidadores: {
    id: string;
    nombre: string;
    apellido: string;
    grupoId: string | null;
    rol: string;
    total: number;
  }[];
  alertas: { iglesiaId: string; estado: string; maxHoras: number }[];
};

/* ---------- Iconos vectoriales (sin emojis) ---------- */

export function Icono({
  children,
  className = "h-4 w-4",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const I = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  visitantes: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  usuarioMas: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  usuario: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  reporte: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </>
  ),
  telefono: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  corazon: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  calendario: (
    <>
      <path d="M8 2v4M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  iglesia: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M9 21v-4h6v4" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  salir: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
};

/* ---------- Contexto de filtros ---------- */

type ValorTablero = {
  sesion: Sesion | null;
  iglesias: Iglesia[];
  iglesiaId: string;
  setIglesiaId: (v: string) => void;
  red: string;
  setRed: (v: string) => void;
  grupo: string;
  setGrupo: (v: string) => void;
  consolidador: string;
  setConsolidador: (v: string) => void;
  cargando: boolean;
  recargarIglesias: () => Promise<void>;
  resumen: Resumen | null;
  recargarResumen: () => Promise<void>;
};

const Ctx = createContext<ValorTablero | null>(null);

export function useTablero() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTablero fuera del tablero");
  return v;
}

/* ---------- Piezas visuales ---------- */

export function LogoMini({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`grid shrink-0 grid-cols-2 gap-[2px] overflow-hidden rounded-[9px] border border-white/20 bg-white p-[2px] shadow-[0_3px_10px_rgba(0,0,0,0.28)] ${className}`}
    >
      <div className="bg-wine" />
      <div className="bg-gold-bright" />
      <div className="bg-[#2A7AC0]" />
      <div className="bg-grape" />
    </div>
  );
}

export function TarjetaEstado({
  icono,
  titulo,
  valor,
  pie,
  tinta,
  href,
  detalle,
}: {
  icono: ReactNode;
  titulo: string;
  valor: number | string;
  pie: string;
  tinta: string;
  href?: string;
  detalle?: string;
}) {
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tinta}`}
        >
          <Icono className="h-5 w-5">{icono}</Icono>
        </span>
        <span className="text-[11px] font-black tracking-[0.08em] text-zinc-500 uppercase">
          {titulo}
        </span>
      </div>
      <p className="mt-3 text-[32px] leading-none font-black text-navy">
        {valor}
      </p>
      <p className="mt-1 text-[13px] font-medium text-zinc-600">{pie}</p>
      {detalle && (
        <p className="mt-0.5 text-xs font-bold text-zinc-500">{detalle}</p>
      )}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        title={`Ver visitantes: ${titulo}`}
        className="block rounded-2xl border border-sand/60 bg-white p-4 transition-all duration-200 hover:border-navy/30 hover:shadow-md"
      >
        {contenido}
      </Link>
    );
  }
  return (
    <div className="rounded-2xl border border-sand/60 bg-white p-4">
      {contenido}
    </div>
  );
}

export function Vacio({
  titulo,
  detalle,
}: {
  titulo: string;
  detalle: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-sand bg-white/60 px-6 py-10 text-center">
      <p className="font-bold text-navy">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600">{detalle}</p>
    </div>
  );
}

const TABS_BASE = [
  { href: "/tablero/dashboard", etiqueta: "Dashboard", icono: I.dashboard },
  { href: "/tablero/equipo", etiqueta: "Equipo", icono: I.usuarioMas },
  { href: "/tablero/visitantes", etiqueta: "Visitantes", icono: I.visitantes },
  { href: "/tablero/usuarios", etiqueta: "Usuarios", icono: I.usuarioMas },
  { href: "/tablero/reportes", etiqueta: "Reportes", icono: I.reporte },
];

function Filtro({
  etiqueta,
  colorEtiqueta,
  icono,
  value,
  onChange,
  opciones,
  aria,
  deshabilitado = false,
  motivoDeshabilitado,
}: {
  etiqueta: string;
  colorEtiqueta: string;
  icono: ReactNode;
  value: string;
  onChange: (v: string) => void;
  opciones: { value: string; texto: string }[];
  aria: string;
  deshabilitado?: boolean;
  motivoDeshabilitado?: string;
}) {
  return (
    <label
      className={`flex min-h-[44px] items-center gap-2 rounded-full border border-sand bg-white px-3 py-1 text-sm ${
        deshabilitado ? "cursor-not-allowed opacity-50" : ""
      }`}
      title={
        deshabilitado
          ? (motivoDeshabilitado ?? "Sin opciones en este alcance")
          : undefined
      }
    >
      <span className="text-zinc-500">
        <Icono className="h-4 w-4">{icono}</Icono>
      </span>
      <span className={`text-[11px] font-black tracking-[0.08em] ${colorEtiqueta}`}>
        {etiqueta}:
      </span>
      <select
        aria-label={aria}
        value={value}
        disabled={deshabilitado}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-1 font-semibold text-navy outline-none disabled:cursor-not-allowed"
      >
        {opciones.map((o) => (
          <option key={o.value || "todas"} value={o.value}>
            {o.texto}
          </option>
        ))}
      </select>
      <span className="text-zinc-400">
        <Icono className="h-3.5 w-3.5">{I.chevron}</Icono>
      </span>
    </label>
  );
}

/* ---------- Carcasa ---------- */

export function Cascaron({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [iglesias, setIglesias] = useState<Iglesia[]>([]);
  const [iglesiaId, setIglesiaId] = useState("");
  const [red, setRed] = useState("todas");
  const [grupo, setGrupo] = useState("todos");
  const [consolidador, setConsolidador] = useState("todos");
  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState<Resumen | null>(null);

  async function recargarIglesias() {
    const ri = await fetch("/api/iglesias");
    if (ri.ok) setIglesias(await ri.json());
  }

  async function recargarResumen(idIglesia: string, redSel: string, grupoSel: string, consoSel: string) {
    const qs = new URLSearchParams();
    if (idIglesia) qs.set("iglesiaId", idIglesia);
    if (redSel && redSel !== "todas") qs.set("redId", redSel);
    if (grupoSel && grupoSel !== "todos") qs.set("grupoId", grupoSel);
    if (consoSel && consoSel !== "todos") qs.set("consolidadorId", consoSel);
    const texto = qs.toString();
    const rr = await fetch(`/api/tablero/resumen${texto ? `?${texto}` : ""}`);
    if (rr.ok) setResumen(await rr.json());
  }

  useEffect(() => {
    async function cargar() {
      const yo = await fetch("/api/auth/yo");
      if (yo.status === 401) {
        router.push("/ingresar");
        return;
      }
      const s = await yo.json();
      setSesion({
        sub: s.sub,
        usuario: s.usuario,
        nombre: s.nombre ?? "",
        apellido: s.apellido ?? "",
        rol: s.rol,
        iglesias: s.iglesias ?? [],
        redId: s.redId ?? null,
        grupoId: s.grupoId ?? null,
      });
      const ri = await fetch("/api/iglesias");
      if (ri.ok) {
        const lista: Iglesia[] = await ri.json();
        setIglesias(lista);
        // Roles operativos bajos: pills bloqueados a su alcance.
        if (
          (s.rol === "LIDER_RED" ||
            s.rol === "LIDER_GRUPO" ||
            s.rol === "CONSOLIDADOR") &&
          lista.length > 0
        ) {
          setIglesiaId(lista[0].id);
          if (s.redId) setRed(s.redId);
          if (s.grupoId) setGrupo(s.grupoId);
        } else {
          // "Todas" por defecto con la estadística global del alcance.
          setIglesiaId("");
        }
      }
      setCargando(false);
    }
    void cargar();
  }, [router]);

  useEffect(() => {
    // Recarga del resumen al cambiar la cascada iglesia → red → grupo → consolidador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!cargando) void recargarResumen(iglesiaId, red, grupo, consolidador);
  }, [iglesiaId, red, grupo, consolidador, cargando]);

  const iglesiaActual = useMemo(
    () => iglesias.find((i) => i.id === iglesiaId) ?? null,
    [iglesias, iglesiaId]
  );
  // Cascada: sin iglesia elegida ("Todas") no hay red/grupo/consolidador;
  // las estadísticas agregan todas las iglesias del alcance.
  const iglesiaTodas = iglesiaId === "";
  const gruposDisponibles = useMemo(
    () =>
      (resumen?.grupos ?? []).filter((g) => red === "todas" || g.redId === red),
    [resumen, red]
  );
  // Pills bloqueados al alcance propio (líder red/grupo y consolidador).
  const alcanceFijo =
    !!sesion &&
    (sesion.rol === "LIDER_RED" ||
      sesion.rol === "LIDER_GRUPO" ||
      sesion.rol === "CONSOLIDADOR");
  const esRaso = sesion?.rol === "CONSOLIDADOR";
  const redFija = alcanceFijo && !!sesion?.redId;
  const grupoFijo =
    alcanceFijo &&
    !!sesion?.grupoId &&
    (sesion?.rol === "LIDER_GRUPO" || sesion?.rol === "CONSOLIDADOR");
  // Cascada: si hay grupo elegido, solo sus consolidadores ("Todos" = todo
  // ese grupo). Si solo hay red elegida, solo los de esa red.
  const rasosDisponibles = useMemo(() => {
    const lista = resumen?.consolidadores ?? [];
    if (grupo !== "todos") return lista.filter((c) => c.grupoId === grupo);
    if (red !== "todas") {
      const redDeGrupo = new Map(
        (resumen?.grupos ?? []).map((g) => [g.id, g.redId])
      );
      return lista.filter(
        (c) => c.grupoId !== null && redDeGrupo.get(c.grupoId) === red
      );
    }
    return lista;
  }, [resumen, grupo, red]);

  const consolidadorValido = useMemo(() => {
    if (consolidador === "todos") return "todos";
    return rasosDisponibles.some((c) => c.id === consolidador)
      ? consolidador
      : "todos";
  }, [rasosDisponibles, consolidador]);

  // Si solo hay una opción en un nivel, se elige sola (no "Todas/Todos").
  // En cascada: red → grupo → consolidador.
  /* eslint-disable react-hooks/set-state-in-effect -- autoselección en cascada */
  useEffect(() => {
    if (cargando || !resumen || esRaso || iglesiaTodas) return;
    if (!redFija && red === "todas" && (resumen.redes?.length ?? 0) === 1) {
      setRed(resumen.redes[0].id);
      setGrupo("todos");
      setConsolidador("todos");
      return;
    }
    if (!grupoFijo && grupo === "todos" && gruposDisponibles.length === 1) {
      setGrupo(gruposDisponibles[0].id);
      setConsolidador("todos");
      return;
    }
    if (consolidador === "todos" && rasosDisponibles.length === 1) {
      setConsolidador(rasosDisponibles[0].id);
    }
  }, [
    cargando,
    resumen,
    esRaso,
    iglesiaTodas,
    redFija,
    grupoFijo,
    red,
    grupo,
    consolidador,
    gruposDisponibles,
    rasosDisponibles,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function salir() {
    await fetch("/api/auth/yo", { method: "POST" });
    router.push("/ingresar");
  }

  const valor: ValorTablero = {
    sesion,
    iglesias,
    iglesiaId,
    setIglesiaId,
    red,
    setRed,
    grupo,
    setGrupo,
    consolidador: consolidadorValido,
    setConsolidador,
    cargando,
    recargarIglesias,
    resumen,
    recargarResumen: () => recargarResumen(iglesiaId, red, grupo, consolidador),
  };

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-sm font-semibold text-navy">Cargando tablero…</p>
      </main>
    );
  }

  return (
    <Ctx.Provider value={valor}>
      <div className="min-h-screen text-navy">
        {/* Barra superior */}
        <div className="no-print sticky top-0 z-40 w-full bg-navy text-white shadow-[0_8px_24px_-12px_rgba(32,75,110,0.28)]">
          <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 overflow-hidden px-4 md:px-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/[0.07] via-transparent to-black/10"
            />
            <div className="relative flex min-w-0 items-center gap-3">
              <Link
                href="/tablero/dashboard"
                title="Ir al inicio"
                aria-label="Ir al inicio"
                className="rounded-[9px] transition-opacity duration-200 hover:opacity-80"
              >
                <LogoMini />
              </Link>
              <div className="hidden leading-[1.05] sm:block">
                <p className="text-[13px] leading-none font-black tracking-[0.18em]">
                  I. CUADRANGULAR
                </p>
                <p className="mt-[3px] text-[10px] font-bold tracking-[0.04em] text-gold uppercase">
                  Sistema de Consolidación
                </p>
              </div>
              <div className="ml-2 hidden border-l border-white/15 pl-4 lg:block">
                <p className="text-[9px] leading-none font-black tracking-[0.16em] text-white/50 uppercase">
                  Iglesia actual
                </p>
                <p className="mt-1 max-w-[260px] truncate text-[12px] font-bold text-white">
                  {iglesiaActual ? iglesiaActual.nombre : "Todas las iglesias"}
                </p>
              </div>
              {sesion && (sesion.nombre || sesion.apellido) && (
                <div className="ml-2 hidden border-l border-white/15 pl-4 xl:block">
                  <p className="max-w-[420px] truncate text-[12px] font-bold text-white">
                    HOLA{" "}
                    {`${sesion.nombre ?? ""} ${sesion.apellido ?? ""}`
                      .trim()
                      .toUpperCase()}
                    , DIOS TE BENDIGA
                  </p>
                  <p className="mt-1 text-[10px] font-bold tracking-[0.04em] text-gold uppercase">
                    Gracias por servir al reino
                  </p>
                </div>
              )}
            </div>
            <div className="relative flex items-center gap-2">
              {sesion && (
                <span className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1 pr-1 pl-3 md:flex">
                  <span className="text-right leading-tight">
                    <span className="block max-w-[160px] truncate text-[12px] font-bold">
                      {sesion.usuario}
                    </span>
                    <span className="block text-[9px] font-bold tracking-[0.14em] text-gold">
                      {ETIQUETA_ROL[sesion.rol]}
                    </span>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-black text-navy">
                    {sesion.usuario.charAt(0).toUpperCase()}
                  </span>
                </span>
              )}
              {sesion?.rol === "SUPERADMIN" && (
                <Link
                  href="/admin"
                  className="hidden min-h-[44px] content-center rounded-lg px-3 py-2 text-sm transition-colors duration-200 hover:bg-white/15 sm:block"
                >
                  Admin
                </Link>
              )}
              <button
                onClick={salir}
                title="Salir"
                aria-label="Salir"
                className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg transition-colors duration-200 hover:bg-white/15"
              >
                <Icono className="h-5 w-5">{I.salir}</Icono>
              </button>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="h-[3px] bg-gradient-to-r from-gold via-gold-bright to-gold/60"
          />
        </div>

        {/* Subcabecera: solo tiene sentido para los roles operativos, no superadmin */}
        {sesion?.rol !== "SUPERADMIN" && (
        <div className="border-b border-sand/60 bg-paper">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/tablero/dashboard"
                title="Ir al inicio"
                aria-label="Ir al inicio"
                className="rounded-[9px] transition-opacity duration-200 hover:opacity-80"
              >
                <LogoMini className="h-10 w-10" />
              </Link>
              <div className="leading-tight">
                <p className="text-[13px] font-black tracking-[0.14em]">
                  I. CUADRANGULAR
                </p>
                <p className="text-[11px] text-zinc-500">
                  Sistema de Consolidación
                </p>
              </div>
              <div className="ml-2 hidden items-center gap-2 border-l border-sand pl-4 sm:flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy/10 text-navy">
                  <Icono className="h-5 w-5">{I.iglesia}</Icono>
                </span>
                <span className="leading-tight">
                  <span className="block max-w-[220px] truncate text-[13px] font-bold">
                    {iglesiaActual ? iglesiaActual.nombre : "Todas las iglesias"}
                  </span>
                  <span className="block text-[11px] text-zinc-500">
                    {iglesias.length} iglesia(s) asignadas
                  </span>
                </span>
              </div>
            </div>
            <span className="rounded-full border border-sand bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#1F7A4B]" />
              {iglesias.length} iglesia(s) • {resumen?.total ?? 0} visitantes
            </span>
          </div>
        </div>
        )}

        <main className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
          {/* Tabs primero, filtros después */}
          <nav aria-label="Secciones" className="no-print flex flex-wrap gap-2">
            {(sesion?.rol === "CONSOLIDADOR" ||
            sesion?.rol === "LIDER_GRUPO" ||
            sesion?.rol === "LIDER_RED"
              ? TABS_BASE.filter((t) => t.href !== "/tablero/usuarios")
              : TABS_BASE
            ).map((t) => {
              const activo = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={activo ? "page" : undefined}
                  className={`flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-all duration-200 ${
                    activo
                      ? "border-navy bg-navy text-white shadow-[0_6px_16px_-6px_rgba(32,75,110,0.5)]"
                      : "border-sand bg-white text-zinc-600 hover:bg-paper"
                  }`}
                >
                  <Icono className="h-4 w-4">{t.icono}</Icono>
                  {t.etiqueta}
                </Link>
              );
            })}
          </nav>

          {/* Filtros (en la página de iglesia viene pre-seleccionada y navega al cambiar) */}
          <div className="flex flex-wrap items-center gap-2">
            {esRaso ? (
              <span className="flex min-h-[44px] flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full border border-sand bg-white px-4 py-1 text-sm">
                <span className="text-[11px] font-black tracking-[0.08em] text-navy">
                  IGLESIA:
                </span>
                <span className="font-semibold text-navy">
                  {iglesias.find((i) => i.id === iglesiaId)?.nombre ?? "—"}
                </span>
                <span className="text-zinc-300">•</span>
                <span className="text-[11px] font-black tracking-[0.08em] text-grape">
                  RED:
                </span>
                <span className="font-semibold text-navy">
                  {resumen?.redes.find((r) => r.id === sesion?.redId)?.nombre ?? "—"}
                </span>
                <span className="text-zinc-300">•</span>
                <span className="text-[11px] font-black tracking-[0.08em] text-[#1F7A4B]">
                  GRUPO:
                </span>
                <span className="font-semibold text-navy">
                  {resumen?.grupos.find((g) => g.id === sesion?.grupoId)?.nombre ?? "—"}
                </span>
              </span>
            ) : (
            <>
            <Filtro
              etiqueta="Iglesia"
              colorEtiqueta="text-navy"
              icono={I.iglesia}
              value={iglesiaId}
              onChange={(v) => {
                setIglesiaId(v);
                setRed("todas");
                setGrupo("todos");
                setConsolidador("todos");
                if (v && pathname.startsWith("/tablero/iglesias/")) {
                  router.push(`/tablero/iglesias/${v}`);
                }
              }}
              aria="Filtrar por iglesia"
              deshabilitado={alcanceFijo || iglesias.length === 0}
              opciones={
                iglesias.length > 0
                  ? [
                      ...(!pathname.startsWith("/tablero/iglesias/") &&
                      !alcanceFijo
                        ? [{ value: "", texto: "Todas" }]
                        : []),
                      ...iglesias.map((i) => ({
                        value: i.id,
                        texto: i.nombre,
                      })),
                    ]
                  : [{ value: "", texto: "Sin iglesias" }]
              }
            />
            <Filtro
              etiqueta="Red"
              colorEtiqueta="text-grape"
              icono={I.visitantes}
              value={red}
              onChange={(v) => {
                setRed(v);
                setGrupo("todos");
                setConsolidador("todos");
              }}
              aria="Filtrar por red"
              deshabilitado={redFija || iglesiaTodas || (resumen?.redes.length ?? 0) === 0}
              motivoDeshabilitado={
                iglesiaTodas ? "Elige una iglesia primero" : undefined
              }
              opciones={[
                { value: "todas", texto: "Todas" },
                ...(resumen?.redes.map((r) => ({
                  value: r.id,
                  texto: r.nombre,
                })) ?? []),
              ]}
            />
            <Filtro
              etiqueta="Grupo"
              colorEtiqueta="text-[#1F7A4B]"
              icono={I.visitantes}
              value={grupo}
              onChange={(v) => {
                setGrupo(v);
                setConsolidador("todos");
              }}
              aria="Filtrar por grupo"
              deshabilitado={grupoFijo || iglesiaTodas || gruposDisponibles.length === 0}
              motivoDeshabilitado={
                iglesiaTodas ? "Elige una iglesia primero" : undefined
              }
              opciones={[
                { value: "todos", texto: "Todos" },
                ...gruposDisponibles.map((g) => ({
                  value: g.id,
                  texto: g.nombre,
                })),
              ]}
            />
            <Filtro
              etiqueta="Consolidador"
              colorEtiqueta="text-[#8A6E14]"
              icono={I.usuario}
              value={consolidadorValido}
              onChange={setConsolidador}
              aria="Filtrar por consolidador"
              deshabilitado={iglesiaTodas || rasosDisponibles.length === 0}
              motivoDeshabilitado={
                iglesiaTodas ? "Elige una iglesia primero" : undefined
              }
              opciones={[
                { value: "todos", texto: "Todos" },
                ...rasosDisponibles.map((c) => ({
                  value: c.id,
                  texto: `${c.nombre} ${c.apellido}`,
                })),
              ]}
            />
            </>
            )}
          </div>

          {children}
        </main>
      </div>
    </Ctx.Provider>
  );
}
