import * as jose from "jose";
import { cookies } from "next/headers";
import type { Rol } from "@prisma/client";
import { db } from "./db";

const NOMBRE_COOKIE = "sesion";

export type Sesion = {
  sub: string;
  usuario: string;
  rol: Rol;
  iglesias: string[];
};

function secreto() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Falta JWT_SECRET en .env");
  return new TextEncoder().encode(s);
}

export async function crearToken(sesion: Sesion) {
  return await new jose.SignJWT({ ...sesion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sesion.sub)
    .setExpirationTime("12h")
    .sign(secreto());
}

export async function leerSesion(): Promise<Sesion | null> {
  const c = await cookies();
  const token = c.get(NOMBRE_COOKIE)?.value;
  if (!token) return null;
  let sub: string;
  try {
    const { payload } = await jose.jwtVerify(token, secreto());
    sub = String(payload.sub ?? "");
  } catch {
    return null;
  }
  if (!sub) return null;
  // El token solo identifica al usuario. Rol, iglesias y si sigue activo se
  // leen de la base en cada petición: desactivar a alguien o cambiarle el
  // rol o las iglesias surte efecto al instante, sin esperar a que caduque.
  const u = await db.usuario.findUnique({
    where: { id: sub },
    select: {
      usuario: true,
      rol: true,
      activo: true,
      iglesias: { select: { iglesiaId: true } },
    },
  });
  if (!u || !u.activo) return null;
  return {
    sub,
    usuario: u.usuario,
    rol: u.rol,
    iglesias: u.iglesias.map((i) => i.iglesiaId),
  };
}

export async function guardarSesion(token: string) {
  const c = await cookies();
  c.set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    // Solo por HTTPS en producción (Vercel); en local se usa http://localhost.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export async function cerrarSesion() {
  const c = await cookies();
  c.delete(NOMBRE_COOKIE);
}
