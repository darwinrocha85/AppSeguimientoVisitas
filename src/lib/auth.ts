import * as jose from "jose";
import { cookies } from "next/headers";
import type { Rol } from "@prisma/client";

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
  try {
    const { payload } = await jose.jwtVerify(token, secreto());
    return {
      sub: String(payload.sub ?? payload.sub),
      usuario: String(payload.usuario ?? ""),
      rol: payload.rol as Rol,
      iglesias: Array.isArray(payload.iglesias)
        ? (payload.iglesias as string[])
        : [],
    };
  } catch {
    return null;
  }
}

export async function guardarSesion(token: string) {
  const c = await cookies();
  c.set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export async function cerrarSesion() {
  const c = await cookies();
  c.delete(NOMBRE_COOKIE);
}
