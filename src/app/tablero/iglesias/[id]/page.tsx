"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ETIQUETA_ROL,
  I,
  Icono,
  Vacio,
  useTablero,
  type Rol,
} from "../../ui";
import { formatearTelefono } from "@/lib/telefono";

type Asignado = {
  id: string;
  usuario: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  rol: Rol;
  red: string | null;
  grupo: string | null;
};

const PUEDE_GESTIONAR = ["SUPERADMIN", "PASTOR", "LIDER_CONSOLIDADOR"] as const;
/** En la página de iglesia no se elimina pastor ni líder consolidador. */
const PROTEGIDOS: Rol[] = ["SUPERADMIN", "PASTOR", "LIDER_CONSOLIDADOR"];

export default function DetalleIglesia() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { iglesias, sesion, red, grupo, consolidador, iglesiaId, setIglesiaId, setRed, setGrupo, setConsolidador, resumen, recargarResumen } =
    useTablero();
  const [asignados, setAsignados] = useState<Asignado[]>([]);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [cargando, setCargando] = useState(true);

  const iglesia = iglesias.find((i) => i.id === params.id) ?? null;

  useEffect(() => {
    // La página manda: el filtro global se pre-selecciona con esta iglesia.
    if (iglesiaId !== params.id) {
      setIglesiaId(params.id);
      setRed("todas");
      setGrupo("todos");
      setConsolidador("todos");
    }
    async function cargar() {
      setCargando(true);
      const qs = new URLSearchParams();
      if (red !== "todas") qs.set("redId", red);
      if (grupo !== "todos") qs.set("grupoId", grupo);
      if (consolidador !== "todos") qs.set("consolidadorId", consolidador);
      const texto = qs.toString();
      const r = await fetch(
        `/api/iglesias/${params.id}/usuarios${texto ? `?${texto}` : ""}`
      );
      if (r.status === 403) {
        setSinPermiso(true);
        setCargando(false);
        return;
      }
      if (r.ok) setAsignados(await r.json());
      setCargando(false);
    }
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, red, grupo, consolidador]);

  async function eliminar(a: Asignado) {
    if (
      !window.confirm(
        `¿Desactivar a ${a.nombre} ${a.apellido}? Se conserva su registro.`
      )
    ) {
      return;
    }
    const r = await fetch(`/api/usuarios/${a.id}`, { method: "DELETE" });
    if (r.ok) {
      const r2 = await fetch(`/api/iglesias/${params.id}/usuarios`);
      if (r2.ok) setAsignados(await r2.json());
    } else router.refresh();
  }

  const puedeEliminar =
    !!sesion && (PUEDE_GESTIONAR as readonly string[]).includes(sesion.rol);
  const puedeConfigurar =
    !!sesion &&
    (sesion.rol === "SUPERADMIN" ||
      (sesion.rol === "PASTOR" && sesion.iglesias.includes(params.id)) ||
      (sesion.rol === "LIDER_CONSOLIDADOR" &&
        sesion.iglesias.includes(params.id)));

  const ESTADOS_ALERTA = [
    { clave: "DESEA_SER_CONTACTADO", texto: "De desea contactar a 1er contacto" },
    { clave: "PRIMER_CONTACTO", texto: "De 1er contacto a 2do contacto (incluye bandeja No asignado)" },
    { clave: "SEGUNDO_CONTACTO", texto: "De 2do contacto a visita de amistad" },
    { clave: "VISITA_AMISTAD", texto: "En visita de amistad" },
  ];
  const [limites, setLimites] = useState<Record<string, string>>({});
  const [errorLimite, setErrorLimite] = useState("");

  useEffect(() => {
    if (!resumen) return;
    const ini: Record<string, string> = {};
    for (const a of resumen.alertas) {
      if (a.iglesiaId === params.id) ini[a.estado] = String(a.maxHoras);
    }
    // Sincroniza los inputs con lo configurado (fetch inicial permitido).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLimites(ini);
  }, [resumen, params.id]);

  async function guardarLimite(estado: string) {
    setErrorLimite("");
    const hs = Number(limites[estado]);
    if (!Number.isInteger(hs) || hs < 1 || hs > 2160) {
      setErrorLimite("Horas inválidas (1 a 2160)");
      return;
    }
    const r = await fetch(`/api/iglesias/${params.id}/alertas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, maxHoras: hs }),
    });
    if (!r.ok) setErrorLimite("No se pudo guardar");
    else await recargarResumen();
  }
  const puedeGestionar =
    !!sesion &&
    (sesion.rol === "PASTOR" || sesion.rol === "LIDER_CONSOLIDADOR");

  type Red = {
    id: string;
    nombre: string;
    lider: { id: string; nombre: string; apellido: string } | null;
  };
  type Grupo = {
    id: string;
    nombre: string;
    redId: string;
    lider: { id: string; nombre: string; apellido: string } | null;
  };
  type Candidato = { id: string; nombre: string; apellido: string; usuario: string };
  const [redes, setRedes] = useState<Red[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [nuevaRed, setNuevaRed] = useState("");
  const [editRed, setEditRed] = useState<string | null>(null);
  const [editRedNombre, setEditRedNombre] = useState("");
  const [nuevoGrupoEn, setNuevoGrupoEn] = useState<string | null>(null);
  const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState("");
  const [editGrupo, setEditGrupo] = useState<string | null>(null);
  const [editGrupoNombre, setEditGrupoNombre] = useState("");
  const [asignando, setAsignando] = useState<
    { tipo: "red" | "grupo"; id: string } | null
  >(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [errorOrg, setErrorOrg] = useState("");

  async function cargarOrg() {
    const [rr, rg] = await Promise.all([
      fetch(`/api/redes?iglesiaId=${params.id}`),
      fetch(`/api/grupos?iglesiaId=${params.id}`),
    ]);
    if (rr.ok) setRedes(await rr.json());
    if (rg.ok) setGrupos(await rg.json());
  }

  useEffect(() => {
    async function inicial() {
      const [rr, rg] = await Promise.all([
        fetch(`/api/redes?iglesiaId=${params.id}`),
        fetch(`/api/grupos?iglesiaId=${params.id}`),
      ]);
      if (rr.ok) setRedes(await rr.json());
      if (rg.ok) setGrupos(await rg.json());
    }
    void inicial();
  }, [params.id]);

  async function crearRed(e: React.FormEvent) {
    e.preventDefault();
    setErrorOrg("");
    const r = await fetch("/api/redes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevaRed, iglesiaId: params.id }),
    });
    if (!r.ok) {
      setErrorOrg("No se pudo crear la red");
      return;
    }
    setNuevaRed("");
    await cargarOrg();
  }

  async function guardarRed(id: string) {
    setErrorOrg("");
    const r = await fetch(`/api/redes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editRedNombre }),
    });
    if (!r.ok) {
      setErrorOrg("No se pudo guardar");
      return;
    }
    setEditRed(null);
    await cargarOrg();
  }

  async function crearGrupo(redId: string) {
    setErrorOrg("");
    const r = await fetch("/api/grupos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoGrupoNombre, redId }),
    });
    if (!r.ok) {
      setErrorOrg("No se pudo crear el grupo");
      return;
    }
    setNuevoGrupoNombre("");
    setNuevoGrupoEn(null);
    await cargarOrg();
  }

  async function guardarGrupo(id: string) {
    setErrorOrg("");
    const r = await fetch(`/api/grupos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editGrupoNombre }),
    });
    if (!r.ok) {
      setErrorOrg("No se pudo guardar");
      return;
    }
    setEditGrupo(null);
    await cargarOrg();
  }

  async function abrirAsignar(tipo: "red" | "grupo", id: string) {
    setErrorOrg("");
    const rol = tipo === "red" ? "LIDER_RED" : "LIDER_GRUPO";
    const r = await fetch(
      `/api/usuarios/lideres?rol=${rol}&iglesiaId=${params.id}`
    );
    if (r.ok) setCandidatos(await r.json());
    else setCandidatos([]);
    setAsignando({ tipo, id });
  }

  async function asignarLider(candidatoId: string) {
    if (!asignando) return;
    setErrorOrg("");
    const ruta =
      asignando.tipo === "red"
        ? `/api/redes/${asignando.id}`
        : `/api/grupos/${asignando.id}`;
    const r = await fetch(ruta, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liderId: candidatoId || null }),
    });
    if (!r.ok) {
      setErrorOrg("No se pudo asignar");
      return;
    }
    setAsignando(null);
    await cargarOrg();
  }

  if (cargando) {
    return <p className="text-sm font-semibold text-navy">Cargando iglesia…</p>;
  }

  if (!iglesia || sinPermiso) {
    return (
      <Vacio
        titulo="Sin acceso a esta iglesia"
        detalle="No está en tu alcance o fue desactivada."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/tablero/dashboard"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-navy/70 hover:underline"
      >
        ← Volver al Dashboard
      </Link>

      <section className="rounded-2xl border border-sand/60 bg-white p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy text-2xl font-black text-white">
            {iglesia.nombre.charAt(0).toUpperCase()}
          </span>
          <div className="leading-tight">
            <h1 className="text-lg font-black text-navy">{iglesia.nombre}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {[iglesia.direccion, iglesia.telefono ? formatearTelefono(iglesia.telefono) : null]
                .filter(Boolean)
                .join(" • ") || "Sin datos registrados"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-sand/60 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grape text-white">
              <Icono className="h-5 w-5">{I.visitantes}</Icono>
            </span>
            <div className="leading-tight">
              <h2 className="text-[15px] font-black text-navy">
                Redes y grupos ({redes.length})
              </h2>
              <p className="text-xs text-zinc-500">
                {puedeGestionar
                  ? "Crea, renombra y asigna líderes."
                  : "Solo lectura para tu rol."}
              </p>
            </div>
          </div>
        </div>
        {errorOrg && (
          <p role="alert" className="mt-2 text-sm font-semibold text-wine">
            {errorOrg}
          </p>
        )}
        {puedeGestionar && (
          <form
            onSubmit={crearRed}
            className="mt-3 flex flex-wrap gap-2"
          >
            <input
              aria-label="Nombre de la nueva red"
              className="min-h-[44px] flex-1 rounded-xl border border-sand bg-paper px-4 text-sm text-navy outline-none placeholder:text-[#B8A99A]/70 focus:border-navy/30 focus:ring-4 focus:ring-navy/[0.06]"
              placeholder="Nueva red…"
              value={nuevaRed}
              onChange={(e) => setNuevaRed(e.target.value)}
              required
            />
            <button className="min-h-[44px] cursor-pointer rounded-xl bg-navy px-4 text-sm font-black text-white uppercase transition-all duration-200 hover:bg-navy-dark">
              Crear red
            </button>
          </form>
        )}
        {redes.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Esta iglesia aún no tiene redes.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {redes.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-sand/70 bg-paper p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {editRed === r.id ? (
                    <>
                      <input
                        aria-label="Nombre de la red"
                        className="min-h-[44px] flex-1 rounded-xl border border-sand bg-white px-3 text-sm text-navy outline-none"
                        value={editRedNombre}
                        onChange={(e) => setEditRedNombre(e.target.value)}
                      />
                      <button
                        onClick={() => guardarRed(r.id)}
                        className="min-h-[44px] cursor-pointer rounded-xl bg-navy px-3 text-sm font-black text-white"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditRed(null)}
                        className="min-h-[44px] cursor-pointer rounded-xl border border-sand bg-white px-3 text-sm font-bold text-navy"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-[14px] font-bold text-navy">
                        {r.nombre}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {r.lider
                          ? `Líder: ${r.lider.nombre} ${r.lider.apellido}`
                          : "Sin líder"}
                      </span>
                      {puedeGestionar && (
                        <span className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditRed(r.id);
                              setEditRedNombre(r.nombre);
                            }}
                            className="min-h-[40px] cursor-pointer rounded-lg px-2 text-[12px] font-bold text-navy/70 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => abrirAsignar("red", r.id)}
                            className="min-h-[40px] cursor-pointer rounded-lg px-2 text-[12px] font-bold text-navy/70 hover:underline"
                          >
                            Líder
                          </button>
                          <button
                            onClick={() => {
                              setNuevoGrupoEn(
                                nuevoGrupoEn === r.id ? null : r.id
                              );
                              setNuevoGrupoNombre("");
                            }}
                            className="min-h-[40px] cursor-pointer rounded-lg px-2 text-[12px] font-bold text-navy/70 hover:underline"
                          >
                            + Grupo
                          </button>
                        </span>
                      )}
                    </>
                  )}
                </div>
                {asignando?.tipo === "red" && asignando.id === r.id && (
                  <div className="mt-2 rounded-xl border border-sand bg-white p-2">
                    {candidatos.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-zinc-500">
                        No hay líderes de red disponibles (créalo en Usuarios).
                      </p>
                    ) : (
                      <ul className="max-h-36 overflow-auto">
                        {candidatos.map((c) => (
                          <li key={c.id}>
                            <button
                              onClick={() => asignarLider(c.id)}
                              className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-paper"
                            >
                              {c.nombre} {c.apellido} · @{c.usuario}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {nuevoGrupoEn === r.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      aria-label="Nombre del nuevo grupo"
                      className="min-h-[44px] flex-1 rounded-xl border border-sand bg-white px-3 text-sm text-navy outline-none"
                      placeholder="Nuevo grupo…"
                      value={nuevoGrupoNombre}
                      onChange={(e) => setNuevoGrupoNombre(e.target.value)}
                    />
                    <button
                      onClick={() => crearGrupo(r.id)}
                      className="min-h-[44px] cursor-pointer rounded-xl bg-navy px-3 text-sm font-black text-white"
                    >
                      Crear
                    </button>
                  </div>
                )}
                <ul className="mt-2 space-y-1.5 pl-2">
                  {grupos
                    .filter((g) => g.redId === r.id)
                    .map((g) => (
                      <li
                        key={g.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                      >
                        {editGrupo === g.id ? (
                          <>
                            <input
                              aria-label="Nombre del grupo"
                              className="min-h-[40px] flex-1 rounded-lg border border-sand px-2 text-sm text-navy outline-none"
                              value={editGrupoNombre}
                              onChange={(e) =>
                                setEditGrupoNombre(e.target.value)
                              }
                            />
                            <button
                              onClick={() => guardarGrupo(g.id)}
                              className="cursor-pointer text-[12px] font-bold text-navy hover:underline"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditGrupo(null)}
                              className="cursor-pointer text-[12px] font-bold text-zinc-500 hover:underline"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 font-semibold text-navy">
                              {g.nombre}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {g.lider
                                ? `${g.lider.nombre} ${g.lider.apellido}`
                                : "Sin líder"}
                            </span>
                            {puedeGestionar && (
                              <span className="flex gap-1">
                                <button
                                  onClick={() => {
                                    setEditGrupo(g.id);
                                    setEditGrupoNombre(g.nombre);
                                  }}
                                  className="cursor-pointer text-[12px] font-bold text-navy/70 hover:underline"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => abrirAsignar("grupo", g.id)}
                                  className="cursor-pointer text-[12px] font-bold text-navy/70 hover:underline"
                                >
                                  Líder
                                </button>
                              </span>
                            )}
                          </>
                        )}
                        {asignando?.tipo === "grupo" && asignando.id === g.id && (
                          <div className="mt-1 w-full rounded-xl border border-sand bg-paper p-2">
                            {candidatos.length === 0 ? (
                              <p className="px-2 py-1 text-xs text-zinc-500">
                                No hay líderes de grupo disponibles (créalo en
                                Usuarios).
                              </p>
                            ) : (
                              <ul className="max-h-36 overflow-auto">
                                {candidatos.map((c) => (
                                  <li key={c.id}>
                                    <button
                                      onClick={() => asignarLider(c.id)}
                                      className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-white"
                                    >
                                      {c.nombre} {c.apellido} · @{c.usuario}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {puedeConfigurar && (
        <section className="rounded-2xl border border-sand/60 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-white">
              <Icono className="h-5 w-5">{I.calendario}</Icono>
            </span>
            <div className="leading-tight">
              <h2 className="text-[15px] font-black text-navy">
                Tiempos de alerta (CRUD por iglesia)
              </h2>
              <p className="text-xs text-zinc-500">
                Horas permitidas por transición antes de avisar. Orden: Desea
                &gt; 1er &gt; No asignado 2do &gt; 2do &gt; Visita. El tramo No
                asignado es derivado (1er contacto sin consolidador) y usa el
                tiempo de 1er contacto.
              </p>
            </div>
          </div>
          {errorLimite && (
            <p role="alert" className="mt-2 text-sm font-semibold text-wine">
              {errorLimite}
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {ESTADOS_ALERTA.map((e) => (
              <li
                key={e.clave}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-sand/70 bg-paper px-3 py-2"
              >
                <span className="min-w-0 flex-1 text-sm font-semibold text-navy">
                  {e.texto}
                </span>
                <input
                  aria-label={`Horas para ${e.texto}`}
                  className="h-[44px] w-24 rounded-xl border border-sand bg-white px-3 text-sm text-navy outline-none"
                  inputMode="numeric"
                  value={limites[e.clave] ?? ""}
                  onChange={(ev) =>
                    setLimites((l) => ({
                      ...l,
                      [e.clave]: ev.target.value.replace(/\D/g, "").slice(0, 4),
                    }))
                  }
                />
                <span className="text-xs text-zinc-500">horas</span>
                <button
                  onClick={() => guardarLimite(e.clave)}
                  className="min-h-[44px] cursor-pointer rounded-xl bg-navy px-4 text-sm font-black text-white uppercase transition-all duration-200 hover:bg-navy-dark"
                >
                  Guardar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-sand/60 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
            <Icono className="h-5 w-5">{I.usuarioMas}</Icono>
          </span>
          <div className="leading-tight">
            <h2 className="text-[15px] font-black text-navy">
              Usuarios asignados ({asignados.length})
            </h2>
            <p className="text-xs text-zinc-500">
              Pastor y líder consolidador están protegidos: no se eliminan aquí.
              Se aplican los filtros superiores.
            </p>
          </div>
        </div>
        {asignados.length === 0 ? (
          <div className="mt-4">
            <Vacio
              titulo="Nadie asignado"
              detalle="Asigna pastores o líderes desde su perfil de usuario."
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {asignados.map((a) => {
              const protegido = PROTEGIDOS.includes(a.rol);
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-sand/70 bg-paper p-3"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-lg font-black text-navy">
                    {a.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-bold text-navy">
                        {a.nombre} {a.apellido}
                      </span>
                      <span className="rounded-full border border-navy/20 bg-navy/5 px-2 py-0.5 text-[10px] font-black tracking-[0.06em] text-navy">
                        {ETIQUETA_ROL[a.rol]}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      @{a.usuario}
                      {a.telefono && ` • ${formatearTelefono(a.telefono)}`}
                      {[a.red, a.grupo].filter(Boolean).length > 0 &&
                        ` • ${[a.red, a.grupo].filter(Boolean).join(" • ")}`}
                    </span>
                  </span>
                  {puedeEliminar && !protegido && (
                    <button
                      onClick={() => eliminar(a)}
                      className="min-h-[44px] shrink-0 cursor-pointer rounded-lg px-3 text-[12px] font-bold text-wine/80 underline-offset-2 hover:underline"
                    >
                      Eliminar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
