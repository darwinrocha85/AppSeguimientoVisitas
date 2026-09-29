"use client";

import { useState } from "react";
import Link from "next/link";
import { I, Icono, TarjetaEstado, useTablero } from "../ui";
import { formatearTelefono, soloDigitos } from "@/lib/telefono";

/* 4 estados literales del seguimiento (decisión confirmada) */
const ESTADOS = [
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

export default function Dashboard() {
  const { iglesias, iglesiaId, setIglesiaId, setRed, setGrupo, setConsolidador, sesion, recargarIglesias, resumen, recargarResumen } =
    useTablero();
  const esAdmin = sesion?.rol === "SUPERADMIN";
  const visibles = iglesiaId
    ? iglesias.filter((i) => i.id === iglesiaId)
    : iglesias;
  const totalPorIglesia = Object.fromEntries(
    (resumen?.porIglesia ?? []).map((p) => [p.iglesiaId, p.total])
  );

  const [formAbierto, setFormAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDireccion, setEditDireccion] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [errorEdit, setErrorEdit] = useState("");
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  async function crearIglesia(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    const r = await fetch("/api/iglesias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        direccion: direccion || undefined,
        telefono: telefono || undefined,
      }),
    });
    setGuardando(false);
    if (!r.ok) {
      setError("No se pudo crear la iglesia");
      return;
    }
    setNombre("");
    setDireccion("");
    setTelefono("");
    setFormAbierto(false);
    await recargarIglesias();
    await recargarResumen();
  }

  function abrirEdicion(id: string, n: string, d?: string | null, t?: string | null) {
    setEditandoId(id);
    setEditNombre(n);
    setEditDireccion(d ?? "");
    setEditTelefono(t ?? "");
    setErrorEdit("");
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editandoId) return;
    setErrorEdit("");
    setGuardandoEdit(true);
    const r = await fetch(`/api/iglesias/${editandoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: editNombre,
        direccion: editDireccion || null,
        telefono: editTelefono || null,
      }),
    });
    setGuardandoEdit(false);
    if (!r.ok) {
      setErrorEdit("No se pudo guardar");
      return;
    }
    setEditandoId(null);
    await recargarIglesias();
    await recargarResumen();
  }

  async function eliminarIglesia(id: string, nombreIglesia: string) {
    if (
      !window.confirm(
        `¿Desactivar "${nombreIglesia}" y todo lo que depende de ella (redes, grupos, visitantes)? Los datos se conservan en la base de datos.`
      )
    ) {
      return;
    }
    setEliminando(true);
    const r = await fetch(`/api/iglesias/${id}`, { method: "DELETE" });
    setEliminando(false);
    if (!r.ok) {
      setError("No se pudo desactivar la iglesia");
      return;
    }
    if (id === iglesiaId) setIglesiaId("");
    await recargarIglesias();
    await recargarResumen();
  }

  const campo =
    "min-h-[44px] rounded-xl border border-sand bg-white px-4 text-sm text-navy outline-none placeholder:text-[#B8A99A]/70 focus:border-navy/30 focus:ring-4 focus:ring-navy/[0.06]";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ESTADOS.map((e) => (
          <TarjetaEstado
            key={e.clave}
            icono={e.icono}
            titulo={e.titulo}
            valor={resumen?.porEstado[e.clave] ?? 0}
            pie={e.pie}
            tinta={e.tinta}
          />
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-sand/60 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand/60 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
              <Icono className="h-5 w-5">{I.iglesia}</Icono>
            </span>
            <div className="leading-tight">
              <h2 className="text-[15px] font-black text-navy">
                Iglesia seleccionada
              </h2>
              <p className="text-xs text-zinc-500">
                {iglesiaId
                  ? "Mostrando la iglesia elegida arriba"
                  : "Mostrando todas las de tu alcance"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sand bg-paper px-3 py-1 text-xs font-bold text-navy">
              {visibles.length} iglesia(s)
            </span>
            {esAdmin && (
              <button
                onClick={() => setFormAbierto((v) => !v)}
                className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full bg-navy px-5 text-sm font-black tracking-wide text-white uppercase transition-all duration-200 hover:bg-navy-dark"
              >
                <Icono className="h-4 w-4">{I.mas}</Icono>
                Nueva
              </button>
            )}
          </div>
        </div>
        {esAdmin && formAbierto && (
          <form
            onSubmit={crearIglesia}
            className="grid grid-cols-1 gap-2 border-b border-sand/60 bg-paper p-4 md:grid-cols-4"
          >
            <input
              aria-label="Nombre de la iglesia"
              className={campo}
              placeholder="Nombre de la iglesia"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
            <input
              aria-label="Dirección"
              className={campo}
              placeholder="Dirección"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
            <input
              aria-label="Teléfono"
              className={campo}
              placeholder="Teléfono (607 35 00 44)"
              inputMode="numeric"
              value={formatearTelefono(telefono)}
              onChange={(e) => setTelefono(soloDigitos(e.target.value))}
            />
            <button
              disabled={guardando}
              className="min-h-[44px] cursor-pointer rounded-xl bg-wine px-4 text-sm font-black tracking-wide text-white uppercase transition-all duration-200 hover:bg-[#8A1830] disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Crear"}
            </button>
            {error && (
              <p role="alert" className="text-sm font-semibold text-wine md:col-span-4">
                {error}
              </p>
            )}
          </form>
        )}
        {visibles.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">
            Aún no tienes iglesias asignadas.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            {visibles.map((ig) => (
              <li
                key={ig.id}
                className="rounded-xl border border-sand/70 bg-paper p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-lg font-black text-navy">
                    {ig.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <Link
                      href={`/tablero/iglesias/${ig.id}`}
                      title="Ver información de la iglesia"
                      onClick={() => {
                        setIglesiaId(ig.id);
                        setRed("todas");
                        setGrupo("todos");
                        setConsolidador("todos");
                      }}
                      className="block max-w-full truncate text-left text-[14px] font-bold text-navy underline-offset-2 hover:underline"
                    >
                      {ig.nombre}
                    </Link>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {[
                        ig.direccion,
                        ig.telefono ? formatearTelefono(ig.telefono) : null,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "Sin dirección registrada"}
                    </span>
                  </span>
                  <span className="text-right leading-tight">
                    <span className="block text-xl font-black text-navy">
                      {totalPorIglesia[ig.id] ?? 0}
                    </span>
                    <span className="block text-[10px] font-bold tracking-[0.08em] text-zinc-500 uppercase">
                      Visitantes
                    </span>
                  </span>
                </div>
                {esAdmin && (
                  <div className="mt-2">
                    {editandoId === ig.id ? (
                      <form onSubmit={guardarEdicion} className="grid gap-2">
                        <input
                          aria-label="Nombre"
                          className={campo}
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          required
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            aria-label="Dirección"
                            className={campo}
                            placeholder="Dirección"
                            value={editDireccion}
                            onChange={(e) => setEditDireccion(e.target.value)}
                          />
                          <input
                            aria-label="Teléfono"
                            className={campo}
                            placeholder="Teléfono (607 35 00 44)"
                            inputMode="numeric"
                            value={formatearTelefono(editTelefono)}
                            onChange={(e) =>
                              setEditTelefono(soloDigitos(e.target.value))
                            }
                          />
                        </div>
                        {errorEdit && (
                          <p role="alert" className="text-sm font-semibold text-wine">
                            {errorEdit}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            disabled={guardandoEdit}
                            className="min-h-[44px] flex-1 cursor-pointer rounded-xl bg-navy px-4 text-sm font-black text-white uppercase transition-all duration-200 hover:bg-navy-dark disabled:opacity-60"
                          >
                            {guardandoEdit ? "Guardando…" : "Guardar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditandoId(null)}
                            className="min-h-[44px] cursor-pointer rounded-xl border border-sand bg-white px-4 text-sm font-bold text-navy"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          onClick={() =>
                            abrirEdicion(ig.id, ig.nombre, ig.direccion, ig.telefono)
                          }
                          className="min-h-[40px] cursor-pointer rounded-lg px-1 text-[12px] font-bold text-navy/70 underline-offset-2 hover:underline"
                        >
                          Editar datos
                        </button>
                        <button
                          onClick={() => eliminarIglesia(ig.id, ig.nombre)}
                          disabled={eliminando}
                          className="min-h-[40px] cursor-pointer rounded-lg px-1 text-[12px] font-bold text-wine/80 underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}