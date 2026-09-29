/** Teléfono español: 9 dígitos, se muestra como 607 35 00 44. */

export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 9);
}

export function formatearTelefono(
  valor: string | null | undefined
): string {
  const d = (valor ?? "").replace(/\D/g, "");
  if (d.length !== 9) return d;
  return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

export const TELEFONO_REGEX = /^\d{9}$/;
export const TELEFONO_AYUDA = "Teléfono: 9 dígitos (p. ej. 607 35 00 44)";
