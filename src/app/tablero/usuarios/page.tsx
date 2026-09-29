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
  iglesias: { iglesia: { id: string; nombre: string } }[];
};

const campo =
  "min-h-[44px] rounded-xl border border-sand bg-white px-4 text-sm text-navy outline-none placeholder:text-[#B8A99A]/70 focus:border-navy/30 focus:ring-4 focus:ring-navy/[0.06]";

export default function Usuarios() {
  const { iglesias, setIglesiaId, setRed, setGrupo, setConsolidador } =
    useTablero();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [restringido, setRestringido] = useState(false);
  const [cargando, setCargando] = useState(true);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [asignadas, setAsignadas] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [perfil, setPerfil] = useState<Usuario | null>(null);

  async function cargar() {
    const r = await fetch("/api/usuarios");
    if (r.status === 403) {
      setRestringido(true);
      setCargando(false);
      return;
    }
    if (r.ok) setUsuarios(await r.json());
    setCargando(false);
  }

  useEffect(() => {
    // Carga inicial de usuarios del alcance.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, []);

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
    setAsignadas(u.iglesias.map((x) => x.iglesia.id));
    setError("");
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editandoId) return;
    if (asignadas.length === 0) {
      setError("Debe estar al menos en una iglesia (máximo dos)");
      return;
    }
    setError("");
    setGuardando(true);
    const r = await fetch(`/api/usuarios/${editandoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        apellido,
        telefono: telefono || null,
        iglesiaIds: asignadas,
      }),
    });
    setGuardando(false);
    if (!r.ok) {
      setError("No se pudo guardar");
      return;
    }
    setEditandoId(null);
    await cargar();
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
      setError("No se pudo desactivar");
      return;
    }
    await cargar();
  }

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
              Pastores y líderes consolidadores
            </h2>
            <p className="text-xs text-zinc-500">
              Crear, editar y desactivar. Clic en el nombre para ver su perfil.
            </p>
          </div>
        </div>
        <Link
          href="/admin"
          className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-navy px-5 text-sm font-black tracking-wide text-white uppercase transition-all duration-200 hover:bg-navy-dark"
        >
          <Icono className="h-4 w-4">{I.mas}</Icono>
          Crear usuario
        </Link>
      </div>
      {error && !editandoId && (
        <p role="alert" className="mt-3 text-sm font-semibold text-wine">
          {error}
        </p>
      )}
      {usuarios.length === 0 ? (
        <div className="mt-4">
          <Vacio
            titulo="Sin usuarios"
            detalle="Crea el primer pastor o líder consolidador desde el panel de administración."
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
                      onClick={() => setPerfil(u)}
                      title="Ver perfil y afiliaciones"
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
                  {u.rol !== "SUPERADMIN" && (
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
                  <div className="md:col-span-2">
                    <SelectorIglesias
                      iglesias={iglesias}
                      seleccionadas={asignadas}
                      onChange={setAsignadas}
                    />
                  </div>
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
        </Modal>
      )}
    </section>
  );
}
