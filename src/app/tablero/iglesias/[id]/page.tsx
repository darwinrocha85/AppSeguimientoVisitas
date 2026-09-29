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
  const { iglesias, sesion, red, grupo, consolidador, iglesiaId, setIglesiaId, setRed, setGrupo, setConsolidador } =
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
