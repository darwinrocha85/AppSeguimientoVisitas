"use client";

import { useMemo, useRef, useState } from "react";

export type OpcionIglesia = { id: string; nombre: string };

/**
 * Dropdown con buscador para asignar iglesias (mín 1, máx 2).
 * Se usa desde el usuario; desde la iglesia no se asigna.
 */
export function SelectorIglesias({
  iglesias,
  seleccionadas,
  onChange,
  max = 2,
}: {
  iglesias: OpcionIglesia[];
  seleccionadas: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const opciones = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return iglesias
      .filter((i) => !seleccionadas.includes(i.id))
      .filter((i) => !t || i.nombre.toLowerCase().includes(t))
      .slice(0, 8);
  }, [iglesias, seleccionadas, texto]);

  function agregar(id: string) {
    if (seleccionadas.length >= max) return;
    onChange([...seleccionadas, id]);
    setTexto("");
    setAbierto(false);
  }

  function quitar(id: string) {
    onChange(seleccionadas.filter((x) => x !== id));
  }

  const nombreDe = (id: string) =>
    iglesias.find((i) => i.id === id)?.nombre ?? id;

  return (
    <div ref={caja}>
      <span className="text-xs font-black tracking-[0.06em] text-navy uppercase">
        Iglesias asignadas (mín 1, máx {max})
      </span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {seleccionadas.length === 0 && (
          <span className="text-sm text-zinc-500">Sin asignar</span>
        )}
        {seleccionadas.map((id) => (
          <span
            key={id}
            className="flex items-center gap-1.5 rounded-full border border-navy/20 bg-navy/5 py-1 pr-1.5 pl-3 text-[13px] font-semibold text-navy"
          >
            {nombreDe(id)}
            <button
              type="button"
              onClick={() => quitar(id)}
              aria-label={`Quitar ${nombreDe(id)}`}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-navy/70 hover:bg-navy/10"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      {seleccionadas.length < max && (
        <div className="relative mt-2">
          <input
            aria-label="Buscar iglesia por nombre"
            placeholder="Buscar iglesia por nombre…"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
            className="min-h-[44px] w-full rounded-xl border border-sand bg-white px-4 text-sm text-navy outline-none placeholder:text-[#B8A99A]/70 focus:border-navy/30 focus:ring-4 focus:ring-navy/[0.06]"
          />
          {abierto && opciones.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-xl border border-sand bg-white py-1 shadow-xl"
            >
              {opciones.map((o) => (
                <li key={o.id} role="option" aria-selected="false">
                  <button
                    type="button"
                    onMouseDown={() => agregar(o.id)}
                    className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm text-navy hover:bg-paper"
                  >
                    {o.nombre}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
