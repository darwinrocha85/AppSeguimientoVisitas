import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { crearToken, guardarSesion } from "@/lib/auth";

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

  const ok = await bcrypt.compare(datos.data.contrasena, u.passwordHash);
  if (!ok)
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

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
