"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatearTelefono, soloDigitos } from "@/lib/telefono";
import { SelectorIglesias } from "@/components/SelectorIglesias";

type Iglesia = {
  id: string;
  nombre: string;
};

/** Solo crear pastor o líder consolidador. Editar y ver: tab Usuarios. */
export default function Admin() {
  const router = useRouter();
  const [iglesias, setIglesias] = useState<Iglesia[]>([]);
  const [error, setError] = useState("");
  const [creado, setCreado] = useState("");
  const [form, setForm] = useState({
    usuario: "",
    contrasena: "",
    nombre: "",
    apellido: "",
    telefono: "",
    rol: "PASTOR",
    iglesiaIds: [] as string[],
  });

  useEffect(() => {
    async function cargar() {
      const ri = await fetch("/api/iglesias");
      if (ri.status === 401) {
        router.push("/ingresar");
        return;
      }
      if (!ri.ok) {
        setError("Sin permiso o error al cargar (solo superadmin)");
        return;
      }
      setIglesias(await ri.json());
    }
    void cargar();
  }, [router]);

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreado("");
    if (form.iglesiaIds.length === 0) {
      setError("Debe estar al menos en una iglesia (máximo dos)");
      return;
    }
    const r = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, telefono: form.telefono || undefined }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      setError(j?.error ?? "No se pudo crear el usuario");
      return;
    }
    setCreado(`${j.nombre} ${j.apellido} creado y asignado.`);
    setForm({
      usuario: "",
      contrasena: "",
      nombre: "",
      apellido: "",
      telefono: "",
      rol: "PASTOR",
      iglesiaIds: [],
    });
  }

  const campo =
    "min-h-[44px] rounded-lg border border-sand bg-white p-2 text-navy outline-none placeholder:text-[#B8A99A]/70 focus:border-navy focus:outline-none";

  return (
    <main className="min-h-screen bg-cream">
      <div className="sticky top-0 z-40 w-full bg-navy text-white shadow-[0_8px_24px_-12px_rgba(32,75,110,0.28)]">
        <div className="relative mx-auto flex h-16 w-full max-w-4xl items-center justify-between overflow-hidden px-4 md:px-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/[0.07] via-transparent to-black/10"
          />
          <div className="relative flex items-center gap-3">
            <div
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 grid-cols-2 gap-[2px] overflow-hidden rounded-[9px] border border-white/20 bg-white p-[2px] shadow-[0_3px_10px_rgba(0,0,0,0.28)]"
            >
              <div className="bg-wine" />
              <div className="bg-gold-bright" />
              <div className="bg-[#2A7AC0]" />
              <div className="bg-grape" />
            </div>
            <div className="leading-[1.05]">
              <p className="text-[13px] leading-none font-black tracking-[0.18em] text-white">
                I. CUADRANGULAR
              </p>
              <p className="mt-[3px] text-[10px] font-bold tracking-[0.04em] text-gold uppercase">
                Sistema de Consolidación
              </p>
            </div>
          </div>
          <Link
            className="relative min-h-[44px] content-center rounded-lg px-3 py-2 text-sm transition-colors duration-200 hover:bg-white/15"
            href="/tablero/usuarios"
          >
            ← Volver a Usuarios
          </Link>
        </div>
        <div
          aria-hidden="true"
          className="h-[3px] bg-gradient-to-r from-gold via-gold-bright to-gold/60"
        />
      </div>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <header>
          <h1 className="text-xl font-bold text-navy">Crear usuario</h1>
          <p className="text-sm text-zinc-600">
            Pastor o líder consolidador, en al menos una iglesia (máximo dos).
            Primero crea la iglesia en el Dashboard; después creas su pastor o
            líder aquí y lo asignas.
          </p>
          {iglesias.length === 0 && (
            <p role="alert" className="mt-2 text-sm font-semibold text-wine">
              Aún no hay iglesias: crea primero la iglesia en el Dashboard y
              vuelve aquí a crear su pastor.
            </p>
          )}
        </header>
        {error && (
          <p role="alert" className="text-sm font-semibold text-wine">
            {error}
          </p>
        )}
        {creado && (
          <p role="status" className="rounded-xl border border-[#1F7A4B]/20 bg-[#1F7A4B]/10 px-4 py-2.5 text-sm font-semibold text-[#1F7A4B]">
            {creado}{" "}
            <Link href="/tablero/usuarios" className="underline">
              Ver en Usuarios
            </Link>
          </p>
        )}

        <section className="rounded-xl border border-sand bg-white p-4">
          <form onSubmit={crearUsuario} className="grid gap-2 md:grid-cols-2">
            <input className={campo} placeholder="Usuario login" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} required minLength={3} />
            <input className={campo} placeholder="Contraseña (min 6)" type="password" value={form.contrasena} onChange={(e) => setForm({ ...form, contrasena: e.target.value })} required minLength={6} autoComplete="new-password" />
            <input className={campo} placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            <input className={campo} placeholder="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required />
            <input className={campo} placeholder="Teléfono (607 35 00 44)" inputMode="numeric" value={formatearTelefono(form.telefono)} onChange={(e) => setForm({ ...form, telefono: soloDigitos(e.target.value) })} />
            <select className={`${campo} cursor-pointer`} value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              <option value="PASTOR">Pastor</option>
              <option value="LIDER_CONSOLIDADOR">Líder consolidador</option>
            </select>
            <div className="md:col-span-2">
              <SelectorIglesias
                iglesias={iglesias}
                seleccionadas={form.iglesiaIds}
                onChange={(ids) => setForm({ ...form, iglesiaIds: ids })}
              />
            </div>
            <button className="min-h-[44px] cursor-pointer rounded-lg bg-wine px-4 py-2 font-bold text-white transition-colors duration-200 hover:bg-[#8d1830] md:col-span-2">
              Crear y asignar
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
