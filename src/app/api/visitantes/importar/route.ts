import { NextResponse } from "next/server";
import { z } from "zod";
import { leerSesion } from "@/lib/auth";
import { esGestor } from "@/lib/alcance";

const Esquema = z.object({
  imagenes: z
    .array(
      z.object({
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
        base64: z.string().min(1000).max(15_000_000),
      })
    )
    .min(1)
    .max(5),
});

const PROMPT = `Lee esta ficha manuscrita "DATOS PRIMERA VISITA" de iglesia y devuelve SOLO un JSON array (sin markdown), un objeto por ficha de visitante visible. Campos:
- nombre (texto manuscrito tras "Nombre:", sin el encabezado; null si ilegible/vacio)
- apellido (tras "Apellido:"; null si ilegible/vacio)
- zona (tras "Barrio:"; null si vacio)
- codigoPostal (tras "C.P.:"; null si vacio)
- telefono (tras "Número de Teléfono:"; solo digitos, null si vacio)
- rangoEdad (una de "14-18","18-26","26-40","40-50","50-60","60+" segun la casilla marcada con X o tick; null si ninguna)
- ayudas (array con las opciones marcadas de esta lista exacta: ["Visita de Amistad (VA)","Consejería Pastoral","Estudios bíblicos (ADV)","Asistir a un Pequeño grupo (GC)","Información sobre nuestras actividades semanales","Taller para parejas","Retiro Espiritual (ES)"]; [] si ninguna)
- aceptaComunicaciones (true si SI marcado, false si NO marcado, null si sin marcar)
- aceptaWhatsapp (true si SI marcado en grupos de WhatsApp, false si NO, null si sin marcar)
- confianza (0 a 1: tu certeza global de la lectura manuscrita)
Reglas: ignora el texto legal impreso y la firma; si la letra es ilegible usa null, nunca inventes.
Devuelve un objeto JSON con una sola clave "fichas" cuyo valor es el array de objetos.`;

/**
 * Lee fichas escaneadas (foto) con visión por IA y devuelve los datos para
 * REVISIÓN humana. NO guarda nada: el líder corrige en pantalla y crea cada
 * visitante con el alta normal. Solo pastor/líder consolidador.
 * Usa Vercel AI Gateway (mismo dashboard, sin margen, con capa gratuita):
 * requiere AI_GATEWAY_API_KEY. Modelo via AI_GATEWAY_MODEL.
 */
export async function POST(req: Request) {
  const s = await leerSesion();
  if (!esGestor(s))
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const clave = process.env.AI_GATEWAY_API_KEY;
  if (!clave)
    return NextResponse.json(
      { error: "Falta configurar AI_GATEWAY_API_KEY (Vercel > AI Gateway)" },
      { status: 500 }
    );
  const datos = Esquema.safeParse(await req.json().catch(() => null));
  if (!datos.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const modelo = process.env.AI_GATEWAY_MODEL || "gemini-2.5-flash";
  const base = (process.env.AI_GATEWAY_URL || "https://ai-gateway.vercel.sh/v1").replace(/\/$/, "");
  const lecturas: unknown[] = [];
  for (const img of datos.data.imagenes) {
    let r: Response;
    try {
      r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clave}`,
        },
        body: JSON.stringify({
          model: modelo,
          temperature: 0,
          max_tokens: 2000,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT },
                {
                  type: "image_url",
                  image_url: { url: `data:${img.mime};base64,${img.base64}` },
                },
              ],
            },
          ],
        }),
      });
    } catch {
      return NextResponse.json(
        { error: "No se pudo contactar al lector (red)" },
        { status: 502 }
      );
    }
    if (!r.ok) {
      const codigo = r.status === 429 ? 429 : 502;
      return NextResponse.json(
        { error: codigo === 429 ? "Lector saturado, intenta en un minuto" : "El lector falló" },
        { status: codigo }
      );
    }
    const j = (await r.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const texto = j?.choices?.[0]?.message?.content;
    if (!texto)
      return NextResponse.json(
        { error: "El lector no devolvió datos" },
        { status: 502 }
      );
    try {
      const parsed = JSON.parse(texto) as unknown;
      const arr = Array.isArray(parsed)
        ? parsed
        : (parsed as { fichas?: unknown })?.fichas;
      if (Array.isArray(arr)) lecturas.push(...(arr as unknown[]));
      else throw new Error("forma");
    } catch {
      return NextResponse.json(
        { error: "El lector devolvió formato inválido" },
        { status: 502 }
      );
    }
  }
  return NextResponse.json({ lecturas });
}
