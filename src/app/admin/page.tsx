"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatearTelefono, soloDigitos } from "@/lib/telefono";

type Iglesia = {
  id: string;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
};
type Usuario = {
  id: string;
  usuario: string;
  nombre: string;
  apellido: string;
  telefono?: string | null;
  rol: string;
  iglesias: { iglesia: Iglesia }[];
};

export default function Admin() {
  const router = useRouter();
  const [iglesias, setIglesias] = useState<Iglesia[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [error, setError] = useState("");
  const [nombreIglesia, setNombreIglesia] = useState("");
  const [direccionIglesia, setDireccionIglesia] = useState("");
  const [telefonoIglesia, setTelefonoIglesia] = useState("");
  const [form, setForm] = useState({
    usuario: "",
    contrasena: "",
    nombre: "",
    apellido: "",
    telefono: "",
    rol: "PASTOR",
    iglesiaIds: [] as string[],
  });

  async function cargar() {
    setError("");
    const [ri, ru] = await Promise.all([
      fetch("/api/iglesias"),
      fetch("/api/usuarios"),
    ]);
    if (ri.status === 401 || ru.status === 401) {
      router.push("/ingresar");
      return;
    }
    if (!ri.ok || !ru.ok) {
      setError("Sin permiso o error al cargar (solo superadmin)");
      return;
    }
    setIglesias(await ri.json());
    setUsuarios(await ru.json());
  }

  useEffect(() => {
    // Carga inicial de datos del panel (fetch permitido aquí).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearIglesia(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/iglesias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: nombreIglesia,
        direccion: direccionIglesia || undefined,
        telefono: telefonoIglesia || undefined,
      }),
    });
    if (!r.ok) {
      setError("No se pudo crear la iglesia");
      return;
    }
    setNombreIglesia("");
    setDireccionIglesia("");
    setTelefonoIglesia("");
    cargar();
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
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
    setForm({
      usuario: "",
      contrasena: "",
      nombre: "",
      apellido: "",
      telefono: "",
      rol: "PASTOR",
      iglesiaIds: [],
    });
    cargar();
  }

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
          <a
            className="relative min-h-[44px] content-center rounded-lg px-3 py-2 text-sm transition-colors duration-200 hover:bg-white/15"
            href="/ingresar"
          >
            Cambiar usuario
          </a>
        </div>
        <div
          aria-hidden="true"
          className="h-[3px] bg-gradient-to-r from-gold via-gold-bright to-gold/60"
        />
      </div>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-bold text-navy">
          Panel Superadmin
        </h1>
        <p className="text-sm text-zinc-600">
          Solo crea y edita: iglesia, pastor y líder consolidador.
        </p>
      </header>
      {error && (
        <p role="alert" className="text-sm font-semibold text-wine">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-sand bg-white p-4">
        <h2 className="font-bold text-navy">Iglesias ({iglesias.length})</h2>
        <form onSubmit={crearIglesia} className="mt-2 grid gap-2 md:grid-cols-3">
          <input
            className="rounded-lg border border-sand p-2 focus:border-navy focus:outline-none"
            placeholder="Nombre de la iglesia"
            value={nombreIglesia}
            onChange={(e) => setNombreIglesia(e.target.value)}
          />
          <input
            className="rounded-lg border border-sand p-2 focus:border-navy focus:outline-none"
            placeholder="Dirección"
            value={direccionIglesia}
            onChange={(e) => setDireccionIglesia(e.target.value)}
          />
          <input
            className="rounded-lg border border-sand p-2 focus:border-navy focus:outline-none"
            placeholder="Teléfono (607 35 00 44)"
            inputMode="numeric"
            value={formatearTelefono(telefonoIglesia)}
            onChange={(e) => setTelefonoIglesia(soloDigitos(e.target.value))}
          />
          <button className="min-h-[44px] cursor-pointer rounded-lg bg-navy px-4 py-2 font-bold text-white transition-colors duration-200 hover:bg-navy-dark md:col-span-3">
            Crear
          </button>
        </form>
        <ul className="mt-3 space-y-1 text-sm">
          {iglesias.map((i) => (
            <li key={i.id} className="rounded-lg bg-paper p-2">
              <span className="font-semibold text-navy">{i.nombre}</span>
              {[i.direccion, i.telefono].filter(Boolean).length > 0 && (
                <span className="text-zinc-600">
                  {" • "}
                  {[
                    i.direccion,
                    i.telefono ? formatearTelefono(i.telefono) : null,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-sand bg-white p-4">
        <h2 className="font-bold text-navy">Pastores y líderes consolidadores</h2>
        <form onSubmit={crearUsuario} className="mt-2 grid gap-2 md:grid-cols-2">
          <input className="rounded-lg border border-sand p-2 focus:border-navy focus:outline-none" placeholder="Usuario login" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
          <input className="rounded-lg border border-sand p-2 focus:border-navy focus:outline-none" placeholder="Contraseña (min 6)" type="password" value={form.contrasena} onChange={(e) => setForm({ ...form, contrasena: e.target.value })} />
          <input className="rounded-lg border border-sand p-2 focus:border-navy focus:outline-none" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input className="rounded-lg border border-sand p-2 focus:border-navy focus:outline-none" placeholder="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
          <input className="rounded-lg border border-sand p-2 focus:border-navy focus:outline-none" placeholder="Teléfono (607 35 00 44)" inputMode="numeric" value={formatearTelefono(form.telefono)} onChange={(e) => setForm({ ...form, telefono: soloDigitos(e.target.value) })} />
          <select className="rounded-lg border border-sand bg-white p-2" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            <option value="PASTOR">Pastor</option>
            <option value="LIDER_CONSOLIDADOR">Líder consolidador</option>
          </select>
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-bold">Iglesias (máx 2)</legend>
            {iglesias.map((i) => (
              <label key={i.id} className="mr-4 text-sm">
                <input
                  type="checkbox"
                  checked={form.iglesiaIds.includes(i.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      iglesiaIds: e.target.checked
                        ? [...form.iglesiaIds, i.id].slice(0, 2)
                        : form.iglesiaIds.filter((x) => x !== i.id),
                    })
                  }
                />{" "}
                {i.nombre}
              </label>
            ))}
          </fieldset>
          <button className="min-h-[44px] cursor-pointer rounded-lg bg-wine px-4 py-2 font-bold text-white transition-colors duration-200 hover:bg-[#8d1830] md:col-span-2">
            Crear y asignar
          </button>
        </form>
        <ul className="mt-3 space-y-1 text-sm">
          {usuarios.map((u) => (
            <li key={u.id} className="rounded-lg bg-paper p-2">
              {u.nombre} {u.apellido} • {u.usuario} • {u.rol} •{" "}
              {u.iglesias.map((x) => x.iglesia.nombre).join(", ")}
            </li>
          ))}
        </ul>
      </section>
      </div>
    </main>
  );
}
