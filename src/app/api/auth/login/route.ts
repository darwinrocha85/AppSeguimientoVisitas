import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { crearToken, guardarSesion } from "@/lib/auth";

// Freno a fuerza bruta por cuenta (vale entre instancias de Vercel porque
// vive en la base, no en memoria).
const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;

const Esquema = z.object({
  usuario: z.string().min(1),
  contrasena: z.string().min(1),
});

export async function POST(req: Request) {
  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json(
      { error: "Usuario y contraseña requeridos" },
      { status: 400 }
    );

  const u = await db.usuario.findUnique({
    where: { usuario: datos.data.usuario },
    include: { iglesias: true },
  });
  if (!u || !u.activo)
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

  if (u.bloqueadoHasta && u.bloqueadoHasta.getTime() > Date.now()) {
    const min = Math.ceil((u.bloqueadoHasta.getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { error: `Demasiados intentos fallidos. Prueba de nuevo en ${min} min.` },
      { status: 429 }
    );
  }

  const ok = await bcrypt.compare(datos.data.contrasena, u.passwordHash);
  if (!ok) {
    const intentos = u.intentosFallidos + 1;
    const bloquea = intentos >= MAX_INTENTOS;
    await db.usuario.update({
      where: { id: u.id },
      data: bloquea
        ? {
            intentosFallidos: 0,
            bloqueadoHasta: new Date(Date.now() + BLOQUEO_MIN * 60000),
          }
        : { intentosFallidos: intentos },
    });
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }
  if (u.intentosFallidos > 0 || u.bloqueadoHasta)
    await db.usuario.update({
      where: { id: u.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });

  const token = await crearToken({
    sub: u.id,
    usuario: u.usuario,
    rol: u.rol,
    iglesias: u.iglesias.map((i) => i.iglesiaId),
  });
  await guardarSesion(token);
  return NextResponse.json({
    ok: true,
    rol: u.rol,
    nombre: u.nombre,
    apellido: u.apellido,
  });
}
