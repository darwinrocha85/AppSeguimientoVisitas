"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function LogoCuadrangular() {
  return (
    <div
      aria-hidden="true"
      className="grid h-16 w-16 shrink-0 grid-cols-2 gap-[3px] overflow-hidden rounded-[14px] border border-white/20 bg-white p-[3px] shadow-[0_3px_10px_rgba(0,0,0,0.28)]"
    >
      <div className="rounded-tl-[8px] bg-wine" />
      <div className="rounded-tr-[8px] bg-gold-bright" />
      <div className="rounded-bl-[8px] bg-[#2A7AC0]" />
      <div className="rounded-br-[8px] bg-grape" />
    </div>
  );
}

export default function Ingresar() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, contrasena }),
    });
    const j = await r.json().catch(() => null);
    setCargando(false);
    if (!r.ok) {
      setError(j?.error ?? "No se pudo ingresar");
      return;
    }
    router.push("/tablero");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper p-4 text-navy">
      <div
        aria-hidden="true"
        className="absolute right-0 bottom-0 h-[500px] w-[500px] translate-x-1/3 translate-y-1/3 rounded-full bg-navy/[0.04] blur-[80px]"
      />
      <div className="relative w-full max-w-[420px]">
        <div className="overflow-hidden rounded-[20px] border border-sand/60 bg-white shadow-[0_20px_60px_-15px_rgba(32,75,110,0.25),0_8px_24px_-8px_rgba(0,0,0,0.08)]">
          <div className="relative flex flex-col items-center bg-navy px-8 pt-10 pb-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent"
            />
            <LogoCuadrangular />
            <div className="relative mt-5 text-center">
              <p className="text-[15px] leading-none font-black tracking-[0.22em] text-white">
                I. CUADRANGULAR
              </p>
              <p className="mt-1.5 text-[10px] font-bold tracking-[0.18em] text-gold uppercase">
                Sistema de Consolidación
              </p>
            </div>
            <div
              aria-hidden="true"
              className="mt-5 h-[2px] w-12 rounded-full bg-gold/60"
            />
          </div>
          <form onSubmit={entrar} className="bg-white px-8 pt-8 pb-8">
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="usuario"
                  className="mb-2 block text-[11px] font-black tracking-[0.08em] text-navy uppercase"
                >
                  Usuario
                </label>
                <input
                  id="usuario"
                  name="usuario"
                  className="w-full rounded-xl border border-sand bg-paper px-4 py-3 text-[14px] text-navy transition-all outline-none placeholder:text-[#B8A99A]/70 focus:border-navy/30 focus:ring-4 focus:ring-navy/[0.06]"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="SuperAdmin"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="contrasena"
                  className="mb-2 block text-[11px] font-black tracking-[0.08em] text-navy uppercase"
                >
                  Contraseña
                </label>
                <input
                  id="contrasena"
                  name="contrasena"
                  className="w-full rounded-xl border border-sand bg-paper px-4 py-3 text-[14px] text-navy transition-all outline-none placeholder:text-[#B8A99A]/70 focus:border-navy/30 focus:ring-4 focus:ring-navy/[0.06]"
                  type="password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-wine/20 bg-wine/[0.08] px-4 py-2.5 text-[13px] font-medium text-wine"
                >
                  {error}
                </p>
              )}
              <button
                className="w-full cursor-pointer rounded-xl bg-wine py-3.5 text-[14px] font-black tracking-[0.06em] text-white uppercase shadow-[0_8px_20px_-8px_rgba(169,30,50,0.5)] transition-all hover:bg-[#8A1830] active:scale-[0.98] disabled:opacity-60"
                disabled={cargando}
              >
                {cargando ? "Ingresando…" : "Ingresar"}
              </button>
            </div>
          </form>
        </div>
        <p className="mt-6 text-center text-[10px] tracking-wide text-[#A99C8A]">
          © {new Date().getFullYear()} I. Cuadrangular • Consolidación
        </p>
      </div>
    </main>
  );
}
