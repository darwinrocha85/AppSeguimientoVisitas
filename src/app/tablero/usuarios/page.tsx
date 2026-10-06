"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ETIQUETA_ROL,
  I,
  Icono,
  Vacio,
  useTablero,
  type Rol,
} from "../ui";
import { Modal } from "@/components/Modal";
import { SelectorIglesias } from "@/components/SelectorIglesias";
import { formatearTelefono, soloDigitos } from "@/lib/telefono";

type Usuario = {
  id: string;
  usuario: string;
  nombre: string;
  apellido: string;
  telefono?: string | null;
  rol: Rol;
  red?: string | null;
  grupo?: string | null;
  redId?: string | null;
  grupoId?: string | null;
  iglesias: { iglesia: { id: string; nombre: string } }[];
};

type OpcionAlcance = { id: string; nombre: string };

const campo =
  "min-h-[44px] rounded-xl border border-sand bg-white px-4 text-sm text-navy outline-none placeholder:text-[#B8A99A]/70 focus:border-navy/30 focus:ring-4 focus:ring-navy/[0.06]";

const ROLES_BAJOS: { value: Rol; texto: string }[] = [
  { value: "LIDER_RED", texto: "Líder de red" },
  { value: "LIDER_GRUPO", texto: "Líder de grupo" },
  { value: "CONSOLIDADOR", texto: "Consolidador" },
];

export default function Usuarios() {
  const {
    iglesias,
    setIglesiaId,
    setRed,
    setGrupo,
    setConsolidador,
    iglesiaId,
    red,
    grupo,
    consolidador,
    sesion,
  } = useTablero();
  const esSuper = sesion?.rol === "SUPERADMIN";
  const esGestorUi =
    sesion?.rol === "PASTOR" || sesion?.rol === "LIDER_CONSOLIDADOR";
  const esPastorUi = sesion?.rol === "PASTOR";
  // El pastor también crea líderes consolidadores; el líder consolidador no.
  const ROLES_CREAR: { value: Rol; texto: string }[] = esPastorUi
    ? [...ROLES_BAJOS, { value: "LIDER_CONSOLIDADOR", texto: "Líder consolidador" }]
    : ROLES_BAJOS;

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [restringido, setRestringido] = useState(false);
  const [cargando, setCargando] = useState(true);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [editRol, setEditRol] = useState<Rol>("CONSOLIDADOR");
  const [asignadas, setAsignadas] = useState<string[]>([]);
  const [editRed, setEditRed] = useState("");
  const [editGrupo, setEditGrupo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [perfil, setPerfil] = useState<Usuario | null>(null);

  // Crear (gestores): líder red/grupo o consolidador de sus iglesias.
  const [creando, setCreando] = useState(false);
  const [fUsuario, setFUsuario] = useState("");
  const [fContrasena, setFContrasena] = useState("");
  const [fNombre, setFNombre] = useState("");
  const [fApellido, setFApellido] = useState("");
  const [fTelefono, setFTelefono] = useState("");
  const [fRol, setFRol] = useState<Rol>("CONSOLIDADOR");
  const [fIglesia, setFIglesia] = useState("");
  const [fIglesias, setFIglesias] = useState<string[]>([]);
  const [fRed, setFRed] = useState("");
  const [fGrupo, setFGrupo] = useState("");
  const [fLideraGrupo, setFLideraGrupo] = useState(false);

  // Listas de red/grupo del formulario: se cargan para la iglesia ELEGIDA en
  // el propio formulario, no del resumen del tablero (el filtro superior puede
  // apuntar a otra iglesia y dejaría los desplegables vacíos).
  const [redesForm, setRedesForm] = useState<OpcionAlcance[]>([]);
  const [gruposForm, setGruposForm] = useState<OpcionAlcance[]>([]);
  const [redesEdicion, setRedesEdicion] = useState<OpcionAlcance[]>([]);
  const [gruposEdicion, setGruposEdicion] = useState<OpcionAlcance[]>([]);

  async function cargar() {
    const qs = new URLSearchParams();
    if (iglesiaId) qs.set("iglesiaId", iglesiaId);
    if (red !== "todas") qs.set("redId", red);
    if (grupo !== "todos") qs.set("grupoId", grupo);
    if (consolidador !== "todos") qs.set("consolidadorId", consolidador);
    const texto = qs.toString();
    const r = await fetch(`/api/usuarios${texto ? `?${texto}` : ""}`);
    if (r.status === 403) {
      setRestringido(true);
      setCargando(false);
      return;
    }
    if (r.ok) setUsuarios(await r.json());
    setCargando(false);
  }

  useEffect(() => {
    async function inicial() {
      const qs = new URLSearchParams();
      if (iglesiaId) qs.set("iglesiaId", iglesiaId);
      if (red !== "todas") qs.set("redId", red);
      if (grupo !== "todos") qs.set("grupoId", grupo);
      if (consolidador !== "todos") qs.set("consolidadorId", consolidador);
      const texto = qs.toString();
      const r = await fetch(`/api/usuarios${texto ? `?${texto}` : ""}`);
      if (r.status === 403) {
        setRestringido(true);
        setCargando(false);
        return;
      }
      if (r.ok) setUsuarios(await r.json());
      setCargando(false);
    }
    void inicial();
  }, [iglesiaId, red, grupo, consolidador]);

  function irAIglesia(id: string) {
    setIglesiaId(id);
    setRed("todas");
    setGrupo("todos");
    setConsolidador("todos");
  }

  function abrirEdicion(u: Usuario) {
    setEditandoId(u.id);
    setNombre(u.nombre);
    setApellido(u.apellido);
    setTelefono(u.telefono ? soloDigitos(u.telefono) : "");
    setEditRol(u.rol);
    setAsignadas(u.iglesias.map((x) => x.iglesia.id));
    setEditRed(u.redId ?? "");
    setEditGrupo(u.grupoId ?? "");
    setError("");
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editandoId) return;
    if (esSuper && asignadas.length === 0) {
      setError("Debe estar al menos en una iglesia (máximo dos)");
      return;
    }
    setError("");
    setGuardando(true);
    const cuerpo: Record<string, unknown> = {
      nombre,
      apellido,
      telefono: telefono || null,
    };
    const editado = usuarios.find((x) => x.id === editandoId);
    const rolFinal = editado && ROLES_BAJOS.some((r) => r.value === editado.rol) ? editRol : editado?.rol;
    const cambiaRol = !!editado && rolFinal !== editado.rol;
    if (cambiaRol) cuerpo.rol = rolFinal;
    if (esSuper) {
      cuerpo.iglesiaIds = asignadas;
    } else if (
      usuarios.find((x) => x.id === editandoId)?.rol === "LIDER_CONSOLIDADOR"
    ) {
      // Pastor editando líder: de una a dos iglesias propias, sin red/grupo.
      if (asignadas.length === 0) {
        setError("Debe estar al menos en una iglesia (máximo dos)");
        setGuardando(false);
        return;
      }
      cuerpo.iglesiaIds = asignadas;
    } else {
      const ig = u_iglesiaActual();
      if (!ig) {
        setError("Elige la iglesia");
        setGuardando(false);
        return;
      }
      const rolEdicion = rolFinal;
      if (
        (rolEdicion === "LIDER_RED" || rolEdicion === "LIDER_GRUPO") &&
        !soloDigitos(telefono)
      ) {
        setError("Teléfono obligatorio (9 dígitos)");
        setGuardando(false);
        return;
      }
      if (rolEdicion === "CONSOLIDADOR" && (!editRed || !editGrupo)) {
        setError("El consolidador requiere red y grupo");
        setGuardando(false);
        return;
      }
      if (rolEdicion === "LIDER_RED" && !editRed) {
        setError("El líder de red requiere red");
        setGuardando(false);
        return;
      }
      if (rolEdicion === "LIDER_GRUPO" && !editGrupo) {
        setError("El líder de grupo requiere grupo");
        setGuardando(false);
        return;
      }
      cuerpo.iglesiaIds = [ig];
      // A líder de grupo solo se le manda el grupo: la red se deriva en el
      // servidor (así no choca con la red anterior al cambiar de grupo).
      cuerpo.grupoId = editGrupo || null;
      if (rolFinal !== "LIDER_GRUPO") cuerpo.redId = editRed || null;
    }
    const r = await fetch(`/api/usuarios/${editandoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    setGuardando(false);
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setError(j?.error ?? "No se pudo guardar");
      return;
    }
    setEditandoId(null);
    await cargar();
  }

  function u_iglesiaActual(): string | null {
    const u = usuarios.find((x) => x.id === editandoId);
    if (!u || u.iglesias.length === 0) return iglesias[0]?.id ?? null;
    return u.iglesias[0].iglesia.id;
  }

  /** Quién puede tocar a quién en esta vista (la API vuelve a validar). */
  function puedeEditar(u: Usuario) {
    if (u.rol === "SUPERADMIN") return false;
    if (esSuper) return true;
    if (!esGestorUi) return false;
    // Pastor: todo menos otro pastor. Líder consolidador: solo roles bajos.
    if (esPastorUi) return u.rol !== "PASTOR";
    return !["PASTOR", "LIDER_CONSOLIDADOR"].includes(u.rol);
  }

  async function eliminar(u: Usuario) {
    if (
      !window.confirm(
        `¿Desactivar a ${u.nombre} ${u.apellido}? Se conserva su registro.`
      )
    ) {
      return;
    }
    const r = await fetch(`/api/usuarios/${u.id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setError(j?.error ?? "No se pudo desactivar");
      return;
    }
    await cargar();
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const esLiderNuevo = fRol === "LIDER_CONSOLIDADOR";
    if (esLiderNuevo && fIglesias.length === 0) {
      setError("Elige al menos una iglesia (máximo dos)");
      return;
    }
    if (fRol === "CONSOLIDADOR" && !fRed) {
      setError("El consolidador requiere red");
      return;
    }
    if (fRol === "CONSOLIDADOR" && !fGrupo) {
      setError("El consolidador requiere grupo");
      return;
    }
    if (fRol === "LIDER_RED" && !fRed) {
      setError("El líder de red requiere red");
      return;
    }
    if (fRol === "LIDER_RED" && fLideraGrupo && !fGrupo) {
      setError("Elige el grupo que también lidera");
      return;
    }
    if (fRol === "LIDER_GRUPO" && !fGrupo) {
      setError("El líder de grupo requiere grupo");
      return;
    }
    setError("");
    setGuardando(true);
    const r = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario: fUsuario,
        contrasena: fContrasena,
        nombre: fNombre,
        apellido: fApellido,
        telefono: fTelefono || undefined,
        rol: fRol,
        iglesiaIds: esLiderNuevo ? fIglesias : [fIglesia],
        ...(esLiderNuevo
          ? {}
          : {
              redId: fRed || undefined,
              grupoId:
                fRol === "LIDER_RED"
                  ? fLideraGrupo
                    ? fGrupo || undefined
                    : undefined
                  : fGrupo || undefined,
            }),
      }),
    });
    setGuardando(false);
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      setError(j?.error ?? "No se pudo crear");
      return;
    }
    setCreando(false);
    setFUsuario("");
    setFContrasena("");
    setFNombre("");
    setFApellido("");
    setFTelefono("");
    setFRed("");
    setFGrupo("");
    setFLideraGrupo(false);
    await cargar();
  }

  // Red/grupo del formulario de creación, según su iglesia elegida.
  const mostrarAlcanceCrear =
    esGestorUi && creando && fRol !== "LIDER_CONSOLIDADOR" && !!fIglesia;
  useEffect(() => {
    async function cargarListas() {
      if (!mostrarAlcanceCrear) {
        setRedesForm([]);
        setGruposForm([]);
        return;
      }
      const [rr, gg] = await Promise.all([
        fetch(`/api/redes?iglesiaId=${fIglesia}`),
        fetch(
          fRed
            ? `/api/grupos?redId=${fRed}`
            : `/api/grupos?iglesiaId=${fIglesia}`
        ),
      ]);
      setRedesForm(rr.ok ? await rr.json() : []);
      setGruposForm(gg.ok ? await gg.json() : []);
    }
    void cargarListas();
  }, [mostrarAlcanceCrear, fIglesia, fRed]);

  // Red/grupo del formulario de edición, según la iglesia del usuario.
  const usuarioEdicion = usuarios.find((x) => x.id === editandoId) ?? null;
  const iglesiaEdicion = usuarioEdicion?.iglesias[0]?.iglesia.id ?? "";
  const mostrarAlcanceEdicion =
    !!usuarioEdicion &&
    !esSuper &&
    usuarioEdicion.rol !== "LIDER_CONSOLIDADOR" &&
    !!iglesiaEdicion;
  useEffect(() => {
    async function cargarListas() {
      if (!mostrarAlcanceEdicion) {
        setRedesEdicion([]);
        setGruposEdicion([]);
        return;
      }
      const [rr, gg] = await Promise.all([
        fetch(`/api/redes?iglesiaId=${iglesiaEdicion}`),
        fetch(
          // Al líder de grupo se le muestran todos los grupos de la iglesia
          // (la red se deriva del grupo elegido).
          editRed && editRol !== "LIDER_GRUPO"
            ? `/api/grupos?redId=${editRed}`
            : `/api/grupos?iglesiaId=${iglesiaEdicion}`
        ),
      ]);
      setRedesEdicion(rr.ok ? await rr.json() : []);
      setGruposEdicion(gg.ok ? await gg.json() : []);
    }
    void cargarListas();
  }, [mostrarAlcanceEdicion, iglesiaEdicion, editRed, editRol]);

  if (cargando) {
    return <p className="text-sm font-semibold text-navy">Cargando usuarios…</p>;
  }

  if (restringido) {
    return (
      <Vacio
        titulo="Área restringida"
        detalle="Tu rol solo puede consultar los usuarios de tu alcance. Pide a tu pastor o líder consolidador los datos que necesites."
      />
    );
  }

  return (
    <section className="rounded-2xl border border-sand/60 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grape text-white">
            <Icono className="h-5 w-5">{I.usuarioMas}</Icono>
          </span>
          <div className="leading-tight">
            <h2 className="text-[15px] font-black text-navy">
              {esSuper ? "Pastores y líderes consolidadores" : "Equipo de mis iglesias"}
            </h2>
            <p className="text-xs text-zinc-500">
              {esSuper
                ? "Clic en el nombre para ver su perfil o editarlo."
                : "Clic en el nombre para editar sus datos y rol (según tu permiso) o ver su perfil."}
            </p>
          </div>
        </div>
        {esSuper ? (
          <Link
            href="/admin"
            className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-navy px-5 text-sm font-black tracking-wide text-white uppercase transition-all duration-200 hover:bg-navy-dark"
          >
            <Icono className="h-4 w-4">{I.mas}</Icono>
            Crear usuario
          </Link>
        ) : (
          <button
            onClick={() => {
              setCreando((v) => !v);
              if (!fIglesia && iglesias.length > 0) setFIglesia(iglesias[0].id);
            }}
            className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full bg-navy px-5 text-sm font-black tracking-wide text-white uppercase transition-all duration-200 hover:bg-navy-dark"
          >
            <Icono className="h-4 w-4">{I.mas}</Icono>
            Nuevo
          </button>
        )}
      </div>

      {esGestorUi && creando && (
        <form
          onSubmit={crear}
          className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-sand/60 bg-paper p-3 md:grid-cols-3"
        >
          <input aria-label="Usuario login" className={campo} placeholder="Usuario login" value={fUsuario} onChange={(e) => setFUsuario(e.target.value)} required minLength={3} />
          <input aria-label="Contraseña" className={campo} placeholder="Contraseña (min 6)" type="password" value={fContrasena} onChange={(e) => setFContrasena(e.target.value)} required minLength={6} autoComplete="new-password" />
            <select aria-label="Rol" className={`${campo} cursor-pointer`} value={fRol} onChange={(e) => { const r = e.target.value as Rol; setFRol(r); setFRed(""); setFGrupo(""); setFLideraGrupo(false); if (r === "LIDER_CONSOLIDADOR" && fIglesias.length === 0 && iglesias.length > 0) setFIglesias([iglesias[0].id]); }}>
            {ROLES_CREAR.map((r) => (
              <option key={r.value} value={r.value}>{r.texto}</option>
            ))}
          </select>
          <input aria-label="Nombre" className={campo} placeholder="Nombre" value={fNombre} onChange={(e) => setFNombre(e.target.value)} required />
          <input aria-label="Apellido" className={campo} placeholder="Apellido" value={fApellido} onChange={(e) => setFApellido(e.target.value)} required />
          <input aria-label="Teléfono" className={campo} placeholder="Teléfono (607 35 00 44)" inputMode="numeric" value={formatearTelefono(fTelefono)} onChange={(e) => setFTelefono(soloDigitos(e.target.value))} />
          {fRol === "LIDER_CONSOLIDADOR" ? (
            <div className="md:col-span-2">
              <SelectorIglesias
                iglesias={iglesias}
                seleccionadas={fIglesias}
                onChange={setFIglesias}
              />
            </div>
          ) : (
            <>
              <select aria-label="Iglesia" className={`${campo} cursor-pointer`} value={fIglesia} onChange={(e) => { setFIglesia(e.target.value); setFRed(""); setFGrupo(""); }} required>
                <option value="">Iglesia…</option>
                {iglesias.map((ig) => (
                  <option key={ig.id} value={ig.id}>{ig.nombre}</option>
                ))}
              </select>
              <select aria-label="Red" className={`${campo} cursor-pointer`} value={fRed} required={fRol === "CONSOLIDADOR" || fRol === "LIDER_RED"} disabled={redesForm.length === 0} title={redesForm.length === 0 ? "Sin redes en esta iglesia: créalas primero en su ficha" : undefined} onChange={(e) => { setFRed(e.target.value); setFGrupo(""); setFLideraGrupo(false); }}>
                <option value="">{fRol === "CONSOLIDADOR" || fRol === "LIDER_RED" ? "Red (requerida)…" : "Red (opcional)…"}</option>
                {redesForm.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
              {fRol === "LIDER_RED" ? (
                fRed ? (
                  <div>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-semibold text-navy">
                      <input
                        type="checkbox"
                        checked={fLideraGrupo}
                        onChange={(e) => {
                          setFLideraGrupo(e.target.checked);
                          if (!e.target.checked) setFGrupo("");
                        }}
                        className="h-5 w-5 accent-[#204B6E]"
                      />
                      También es líder de un grupo
                    </label>
                    {fLideraGrupo && (
                      <select aria-label="Grupo que también lidera" className={`${campo} mt-2 w-full cursor-pointer`} value={fGrupo} required disabled={gruposForm.length === 0} title={gruposForm.length === 0 ? "Esta red aún no tiene grupos: créalos en la ficha de la iglesia" : undefined} onChange={(e) => setFGrupo(e.target.value)}>
                        <option value="">Grupo (requerido)…</option>
                        {gruposForm.map((g) => (
                          <option key={g.id} value={g.id}>{g.nombre}</option>
                        ))}
                      </select>
                    )}
                    <p className="mt-1 text-xs text-zinc-500">
                      Con la misma cuenta lidera red y grupo; para que también consolide, asígnale visitantes en Visitantes → Asignar.
                    </p>
                  </div>
                ) : null
              ) : (
                <select aria-label="Grupo" className={`${campo} cursor-pointer`} value={fGrupo} required={fRol === "CONSOLIDADOR" || fRol === "LIDER_GRUPO"} disabled={gruposForm.length === 0} title={gruposForm.length === 0 ? "Sin grupos: elige una red o créalos en la ficha de la iglesia" : undefined} onChange={(e) => setFGrupo(e.target.value)}>
                  <option value="">{fRol === "CONSOLIDADOR" || fRol === "LIDER_GRUPO" ? "Grupo (requerido)…" : "Grupo (opcional)…"}</option>
                  {gruposForm.map((g) => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              )}
            </>
          )}
          <div className="md:col-span-3">
            <button
              disabled={guardando}
              className="min-h-[44px] w-full cursor-pointer rounded-xl bg-wine px-4 text-sm font-black text-white uppercase transition-all duration-200 hover:bg-[#8A1830] disabled:opacity-60"
            >
              {guardando ? "Creando…" : "Crear"}
            </button>
          </div>
        </form>
      )}
      {error && !editandoId && (
        <p role="alert" className="mt-3 text-sm font-semibold text-wine">
          {error}
        </p>
      )}

      {usuarios.length === 0 ? (
        <div className="mt-4">
          <Vacio
            titulo="Sin usuarios en este filtro"
            detalle="Ajusta los filtros superiores o crea el primero."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {usuarios.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-sand/70 bg-paper p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-lg font-black text-navy">
                  {u.nombre.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        // El nombre edita directo si hay permiso; si no, abre
                        // el perfil de solo lectura.
                        if (puedeEditar(u)) {
                          if (editandoId === u.id) setEditandoId(null);
                          else abrirEdicion(u);
                        } else {
                          setPerfil(u);
                        }
                      }}
                      title={puedeEditar(u) ? "Editar datos y rol" : "Ver perfil y afiliaciones"}
                      className="cursor-pointer text-left text-[14px] font-bold text-navy underline-offset-2 hover:underline"
                    >
                      {u.nombre} {u.apellido}
                    </button>
                    <span className="rounded-full border border-navy/20 bg-navy/5 px-2 py-0.5 text-[10px] font-black tracking-[0.06em] text-navy">
                      {ETIQUETA_ROL[u.rol]}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500">
                    @{u.usuario}
                    {u.telefono && ` • ${formatearTelefono(u.telefono)}`}
                    {[u.red, u.grupo].filter(Boolean).length > 0 &&
                      ` • ${[u.red, u.grupo].filter(Boolean).join(" • ")}`}
                  </span>
                  {u.iglesias.length > 0 && (
                    <span className="mt-0.5 block truncate text-xs">
                      {u.iglesias.map((x, idx) => (
                        <span key={x.iglesia.id}>
                          {idx > 0 && <span className="text-zinc-400"> • </span>}
                          <Link
                            href={`/tablero/iglesias/${x.iglesia.id}`}
                            title={`Ver ${x.iglesia.nombre}`}
                            onClick={() => irAIglesia(x.iglesia.id)}
                            className="font-semibold text-navy/80 underline-offset-2 hover:underline"
                          >
                            {x.iglesia.nombre}
                          </Link>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {u.iglesias.length === 1 ? (
                    <Link
                      href={`/tablero/iglesias/${u.iglesias[0].iglesia.id}`}
                      title="Ver iglesia"
                      onClick={() => irAIglesia(u.iglesias[0].iglesia.id)}
                      className="rounded-full border border-sand bg-white px-3 py-1 text-xs font-bold text-navy hover:border-navy/30"
                    >
                      1 iglesia
                    </Link>
                  ) : u.iglesias.length > 1 ? (
                    <Link
                      href={`/tablero/iglesias?usuario=${u.id}`}
                      title="Ver sus iglesias"
                      className="rounded-full border border-sand bg-white px-3 py-1 text-xs font-bold text-navy hover:border-navy/30"
                    >
                      {u.iglesias.length} iglesias
                    </Link>
                  ) : (
                    <span className="rounded-full border border-sand bg-white px-3 py-1 text-xs font-bold text-zinc-400">
                      Sin iglesia
                    </span>
                  )}
                  {puedeEditar(u) && (
                    <span className="flex gap-1">
                      <button
                        onClick={() =>
                          editandoId === u.id
                            ? setEditandoId(null)
                            : abrirEdicion(u)
                        }
                        className="min-h-[40px] cursor-pointer rounded-lg px-2 text-[12px] font-bold text-navy/70 underline-offset-2 hover:underline"
                      >
                        {editandoId === u.id ? "Cerrar" : "Editar"}
                      </button>
                      <button
                        onClick={() => setPerfil(u)}
                        className="min-h-[40px] cursor-pointer rounded-lg px-2 text-[12px] font-bold text-navy/70 underline-offset-2 hover:underline"
                      >
                        Perfil
                      </button>
                      <button
                        onClick={() => eliminar(u)}
                        className="min-h-[40px] cursor-pointer rounded-lg px-2 text-[12px] font-bold text-wine/80 underline-offset-2 hover:underline"
                      >
                        Eliminar
                      </button>
                    </span>
                  )}
                </span>
              </div>
              {editandoId === u.id && (
                <form
                  onSubmit={guardar}
                  className="mt-3 grid grid-cols-1 gap-2 border-t border-sand/60 pt-3 md:grid-cols-3"
                >
                  <input
                    aria-label="Nombre"
                    className={campo}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />
                  <input
                    aria-label="Apellido"
                    className={campo}
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    required
                  />
                  <input
                    aria-label="Teléfono"
                    className={campo}
                    placeholder="Teléfono (607 35 00 44)"
                    inputMode="numeric"
                    value={formatearTelefono(telefono)}
                    onChange={(e) => setTelefono(soloDigitos(e.target.value))}
                  />
                  {esSuper ? (
                    <div className="md:col-span-2">
                      <SelectorIglesias
                        iglesias={iglesias}
                        seleccionadas={asignadas}
                        onChange={setAsignadas}
                      />
                    </div>
                  ) : u.rol === "LIDER_CONSOLIDADOR" ? (
                    <div className="md:col-span-2">
                      <SelectorIglesias
                        iglesias={iglesias}
                        seleccionadas={asignadas}
                        onChange={setAsignadas}
                      />
                    </div>
                  ) : (
                    <>
                      {!esSuper && ROLES_BAJOS.some((r) => r.value === u.rol) && (
                        <select
                          aria-label="Rol"
                          className={`${campo} cursor-pointer`}
                          value={editRol}
                          onChange={(e) => setEditRol(e.target.value as Rol)}
                        >
                          {ROLES_BAJOS.map((r) => (
                            <option key={r.value} value={r.value}>{r.texto}</option>
                          ))}
                        </select>
                      )}
                      <select
                        aria-label="Red"
                        className={`${campo} cursor-pointer`}
                        value={editRed}
                        required={editRol === "CONSOLIDADOR" || editRol === "LIDER_RED"}
                        disabled={redesEdicion.length === 0}
                        title={redesEdicion.length === 0 ? "Sin redes en esta iglesia: créalas primero en su ficha" : undefined}
                        onChange={(e) => {
                          setEditRed(e.target.value);
                          setEditGrupo("");
                        }}
                      >
                        <option value="">{editRol === "CONSOLIDADOR" || editRol === "LIDER_RED" ? "Elige la red…" : "Sin red…"}</option>
                        {redesEdicion.map((r) => (
                          <option key={r.id} value={r.id}>{r.nombre}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Grupo"
                        className={`${campo} cursor-pointer`}
                        value={editGrupo}
                        required={editRol === "CONSOLIDADOR" || editRol === "LIDER_GRUPO"}
                        disabled={gruposEdicion.length === 0}
                        title={editRol === "LIDER_RED" ? "Grupo que también lidera (opcional)" : gruposEdicion.length === 0 ? "Sin grupos: elige una red o créalos en la ficha de la iglesia" : undefined}
                        onChange={(e) => setEditGrupo(e.target.value)}
                      >
                        <option value="">{editRol === "CONSOLIDADOR" || editRol === "LIDER_GRUPO" ? "Elige el grupo…" : "Sin grupo…"}</option>
                        {gruposEdicion.map((g) => (
                          <option key={g.id} value={g.id}>{g.nombre}</option>
                        ))}
                      </select>
                      {(editRol === "LIDER_RED" || editRol === "LIDER_GRUPO") && (
                        <p className="text-xs text-zinc-500 md:col-span-1">
                          También puede consolidar: asígnale visitantes en Visitantes → Asignar.
                        </p>
                      )}
                    </>
                  )}
                  <div className="flex items-end gap-2">
                    <button
                      disabled={guardando}
                      className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-navy px-4 text-sm font-black text-white uppercase transition-all duration-200 hover:bg-navy-dark disabled:opacity-60"
                    >
                      {guardando ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                  {error && (
                    <p role="alert" className="text-sm font-semibold text-wine md:col-span-3">
                      {error}
                    </p>
                  )}
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {perfil && (
        <Modal
          titulo={`${perfil.nombre} ${perfil.apellido}`}
          onCerrar={() => setPerfil(null)}
        >
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-zinc-500">Usuario</dt>
              <dd className="font-semibold text-navy">@{perfil.usuario}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-zinc-500">Rol</dt>
              <dd className="font-semibold text-navy">
                {ETIQUETA_ROL[perfil.rol]}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-zinc-500">Teléfono</dt>
              <dd className="font-semibold text-navy">
                {perfil.telefono
                  ? formatearTelefono(perfil.telefono)
                  : "No registrado"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-zinc-500">Estado</dt>
              <dd className="font-semibold text-[#1F7A4B]">Activo</dd>
            </div>
            <div>
              <dt className="font-bold text-zinc-500">Iglesias</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {perfil.iglesias.map((x) => (
                  <span
                    key={x.iglesia.id}
                    className="rounded-full border border-navy/20 bg-navy/5 px-3 py-1 text-[13px] font-semibold text-navy"
                  >
                    {x.iglesia.nombre}
                  </span>
                ))}
              </dd>
            </div>
            {(perfil.red || perfil.grupo) && (
              <div className="flex justify-between gap-3">
                <dt className="font-bold text-zinc-500">Alcance</dt>
                <dd className="text-right font-semibold text-navy">
                  {[perfil.red, perfil.grupo].filter(Boolean).join(" • ")}
                </dd>
              </div>
            )}
          </dl>
          {puedeEditar(perfil) && (
            <button
              onClick={() => {
                const id = perfil.id;
                setPerfil(null);
                const u = usuarios.find((x) => x.id === id);
                if (u) abrirEdicion(u);
                else setEditandoId(id);
              }}
              className="mt-4 min-h-[44px] w-full cursor-pointer rounded-xl bg-navy px-4 text-sm font-black text-white uppercase transition-all duration-200 hover:bg-navy-dark"
            >
              Editar datos y rol
            </button>
          )}
        </Modal>
      )}
    </section>
  );
}
