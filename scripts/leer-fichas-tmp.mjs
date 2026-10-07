/**
 * Lee las 25 fichas (una sola vez) y guarda lecturas.json para REVISION
 * humana. NO inserta nada en ninguna base.
 *
 * Uso: $env con AI_GATEWAY_API_KEY / AI_GATEWAY_MODEL; node scripts/leer-fichas-tmp.mjs
 */
import fs from "node:fs";

const KEY = process.env.AI_GATEWAY_API_KEY;
const MODEL = process.env.AI_GATEWAY_MODEL || "gemini-2.5-flash";
if (!KEY) {
  console.error("Falta AI_GATEWAY_API_KEY");
  process.exit(2);
}

const PROMPT = `Lee esta ficha manuscrita "DATOS PRIMERA VISITA" de iglesia y devuelve un objeto JSON con una sola clave "fichas" cuyo valor es un array (un objeto por ficha visible). Campos:
- nombre (tras "Nombre:"; null si ilegible/vacio)
- apellido (tras "Apellido:"; null si ilegible/vacio)
- zona (tras "Barrio:"; null si vacio)
- codigoPostal (tras "C.P.:"; null si vacio)
- telefono (tras "Número de Teléfono:"; solo digitos, null si vacio)
- rangoEdad (una de "14-18","18-26","26-40","40-50","50-60","60+" segun casilla marcada; null si ninguna)
- ayudas (array de esta lista exacta: ["Visita de Amistad (VA)","Consejería Pastoral","Estudios bíblicos (ADV)","Asistir a un Pequeño grupo (GC)","Información sobre nuestras actividades semanales","Taller para parejas","Retiro Espiritual (ES)"]; [] si ninguna)
- aceptaComunicaciones (true SI / false NO / null sin marcar)
- aceptaWhatsapp (true SI / false NO / null sin marcar, en grupos de WhatsApp)
- confianza (0 a 1)
Reglas: ignora texto legal y firma; si ilegible usa null, nunca inventes. SOLO el objeto JSON.`;

const DIR = "C:/Users/sebas/AppData/Local/Temp/opencode/fichas";
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".b64")).sort();
const out = [];
let i = 0;
for (const f of files) {
  i++;
  const b64 = fs.readFileSync(`${DIR}/${f}`, "utf8").trim();
  console.log(`[${i}/${files.length}] ${f} (${Math.round(b64.length / 1024)} KB)`);
  const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }] },
      ],
    }),
  });
  if (!r.ok) {
    console.log(`  HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    out.push({ archivo: f, error: `HTTP ${r.status}` });
    continue;
  }
  const j = await r.json();
  try {
    const parsed = JSON.parse(j.choices[0].message.content);
    const arr = Array.isArray(parsed) ? parsed : parsed.fichas;
    out.push({ archivo: f, fichas: arr });
    console.log(`  -> ${JSON.stringify(arr).slice(0, 160)}`);
  } catch {
    out.push({ archivo: f, error: "JSON invalido" });
    console.log("  -> JSON invalido");
  }
  await new Promise((x) => setTimeout(x, 3000));
}
fs.writeFileSync(`${DIR}/lecturas.json`, JSON.stringify(out, null, 1));
console.log("Guardado lecturas.json");
