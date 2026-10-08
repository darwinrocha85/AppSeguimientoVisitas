"use client";

/** Detalle desplegable: peticiones, observaciones, quién invitó e historial
 * de reportes. Los datos ya vienen filtrados por alcance del rol. */

export type HistorialEntrada = {
  deEstado: string | null;
  aEstado: string;
  fechaCambio: string;
  fechaContacto: string | null;
  observaciones: string | null;
};

export function DetalleVisitante({
  v,
}: {
  v: {
    invitadoPor?: string | null;
    peticiones?: string | null;
    observaciones?: string | null;
    historial?: HistorialEntrada[];
  };
}) {
  const fecha = (iso: string) =>
    new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const items = v.historial ?? [];
  return (
    <div className="mt-2 rounded-xl border border-sand/60 bg-white p-3 text-sm text-navy">
      <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <dt className="text-[11px] font-black tracking-[0.06em] text-zinc-500 uppercase">
            Quién lo invitó
          </dt>
          <dd className="font-semibold">{v.invitadoPor || "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-black tracking-[0.06em] text-zinc-500 uppercase">
            Peticiones de oración
          </dt>
          <dd className="font-semibold">{v.peticiones || "—"}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-[11px] font-black tracking-[0.06em] text-zinc-500 uppercase">
            Observaciones
          </dt>
          <dd className="font-semibold">{v.observaciones || "—"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] font-black tracking-[0.06em] text-zinc-500 uppercase">
        Reportes ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">Sin reportes aún.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((h, i) => (
            <li key={i} className="rounded-lg bg-paper px-3 py-1.5 text-xs">
              <span className="font-bold">
                {h.deEstado ? `${h.deEstado} → ` : ""}
                {h.aEstado}
              </span>
              {" · "}
              {h.fechaContacto
                ? `contacto ${fecha(h.fechaContacto)}`
                : `cambio ${fecha(h.fechaCambio)}`}
              {h.observaciones ? ` · ${h.observaciones}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
