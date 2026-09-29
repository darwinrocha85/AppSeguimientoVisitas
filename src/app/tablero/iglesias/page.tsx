"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ETIQUETA_ROL, Icono, I, Vacio, type Rol } from "../ui";

type Usuario = {
  id: string;
  usuario: string;
  nombre: string;
  apellido: string;
  telefono?: string | null;
  rol: Rol;
  iglesias: { iglesia: { id: string; nombre: string } }[];
};

/** Tarjetas de las iglesias de un usuario (superadmin). */
export default function IglesiasDeUsuario() {
  return (
    <Suspense
      fallback={
        <p className="text-sm font-semibold text-navy">Cargando…</p>
      }
    >
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const qp = useSearchParams();
  const usuarioId = qp.get("usuario") ?? "";
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const r = await fetch("/api/usuarios");
      if (r.ok) setUsuarios(await r.json());
      setCargando(false);
    }
    void cargar();
  }, []);

  if (cargando) {
    return <p className="text-sm font-semibold text-navy">Cargando…</p>;
  }

  const u = usuarios.find((x) => x.id === usuarioId);
  if (!u) {
    return (
      <Vacio
        titulo="Usuario no encontrado"
        detalle="Vuelve al tab Usuarios y elige de nuevo sus iglesias."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/tablero/usuarios"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-navy/70 hover:underline"
      >
        ← Volver a Usuarios
      </Link>
      <h1 className="text-lg font-black text-navy">
        Iglesias de {u.nombre} {u.apellido}{" "}
        <span className="ml-1 rounded-full border border-navy/20 bg-white px-2 py-0.5 align-middle text-[10px] font-black tracking-[0.06em]">
          {ETIQUETA_ROL[u.rol]}
        </span>
      </h1>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {u.iglesias.map((x) => (
          <Link
            key={x.iglesia.id}
            href={`/tablero/iglesias/${x.iglesia.id}`}
            className="flex min-h-[44px] items-center gap-3 rounded-xl border border-sand/70 bg-white p-4 transition-all duration-200 hover:border-navy/30 hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-lg font-black text-navy">
              {x.iglesia.nombre.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[14px] font-bold text-navy">
                {x.iglesia.nombre}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                <Icono className="h-3.5 w-3.5">{I.iglesia}</Icono>
                Ver información
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
