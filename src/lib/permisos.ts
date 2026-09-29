import type { Rol } from "@prisma/client";
import type { Sesion } from "./auth";

// Superadmin ve todo pero solo gestiona iglesia, pastor y líder consolidador.
export const ROLES_SUPERADMIN_GESTIONA: Rol[] = [
  "PASTOR",
  "LIDER_CONSOLIDADOR",
];

export function esSuperadmin(s: Sesion | null) {
  return s?.rol === "SUPERADMIN";
}

export function puedeSuperadminCrearRol(rol: Rol) {
  return (ROLES_SUPERADMIN_GESTIONA as string[]).includes(rol);
}

export function iglesiasPermitidas(s: Sesion | null): string[] | "todas" {
  if (!s) return [];
  if (s.rol === "SUPERADMIN") return "todas";
  return s.iglesias;
}
