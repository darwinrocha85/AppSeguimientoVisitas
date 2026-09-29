"use client";

import { useEffect, useRef } from "react";

/** Modal simple centrado con cierre (botón, fondo y tecla Escape). */
export function Modal({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", tecla);
    ref.current?.querySelector("button")?.focus();
    return () => document.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/50 p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-auto rounded-2xl border border-sand bg-white p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-black text-navy">{titulo}</h3>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-navy transition-colors hover:bg-paper"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
