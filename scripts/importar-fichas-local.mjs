/**
 * Inserta en LOCAL las fichas leídas (lecturas.json) en Iglesia Barcelona.
 * 24 de 25: la ficha 5 está ilegible (todo null) y se omite.
 * No toca prod. Hace respaldo de dev.db antes. Idempotente por teléfono.
 *
 * Uso: $env:DATABASE_URL="file:./dev.db"; node scripts/importar-fichas-local.mjs --confirmado
 * Sin --confirmado es simulacro.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(`${process.cwd()}/package.json`);
const BetterSqlite = require("better-sqlite3");

const confirmado = process.argv.includes("--confirmado");
const DIR = "C:/Users/sebas/AppData/Local/Temp/opencode/fichas";
const lecturas = JSON.parse(fs.readFileSync(`${DIR}/lecturas.json`, "utf8"));

const dbPath = `${process.cwd()}/prisma/dev.db`;
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
if (confirmado) fs.copyFileSync(dbPath, `${dbPath}.respaldo-${stamp}`);
const rw = new BetterSqlite(dbPath, { readonly: !confirmado });

const IGLESIA = rw.prepare("SELECT id FROM Iglesia WHERE nombre LIKE '%Barcelona%' AND activo=1").get();
if (!IGLESIA) {
  console.error("No hay iglesia Barcelona activa en local.");
  process.exit(3);
}
const ORIGEN = rw.prepare("SELECT id FROM Origen WHERE nombre='1ra visita iglesia'").get();
const EDAD = { "14-18": 16, "18-26": 22, "26-40": 33, "40-50": 45, "50-60": 55, "60+": 65 };
const tel = (v) => String(v ?? "").replace(/\D/g, "").slice(-9);
const uid = () => "c" + [...crypto.getRandomValues(new Uint8Array(18))].map((b) => (b % 36).toString(36)).join("");

let creados = 0;
const omitidos = [];
const insV = confirmado
  ? rw.prepare(`INSERT INTO Visitante (id,nombre,apellido,zona,telefono,edad,codigoPostal,calle,invitadoPor,peticiones,observaciones,estadoActual,activo,sinContacto,iglesiaId,redId,grupoId,origenId,consolidadorId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,NULL,datetime('now'),datetime('now'))`)
  : null;
const insH = confirmado
  ? rw.prepare(`INSERT INTO VisitanteHistorial (id,visitanteId,deEstado,aEstado,fechaCambio,observaciones) VALUES (?,?,NULL,'DESEA_SER_CONTACTADO',datetime('now'),?)`)
  : null;

for (const e of lecturas) {
  const f = e.fichas?.[0];
  if (!f || !f.nombre) {
    omitidos.push(`${e.archivo}: ilegible, se carga manual`);
    continue;
  }
  // Apellido ausente: parte "Lesly Galeas" -> Lesly / Galeas; nombre largo
  // con 4 tokens -> 2 y 2 (convención nombres españoles).
  let nombre = String(f.nombre).trim();
  let apellido = f.apellido ? String(f.apellido).trim() : "";
  if (!apellido) {
    const p = nombre.split(/\s+/);
    if (p.length >= 2) {
      apellido = p.slice(-2).join(" ");
      nombre = p.slice(0, -2).join(" ") || p[0];
    } else {
      omitidos.push(`${e.archivo}: sin apellido, se carga manual`);
      continue;
    }
  }
  const zona = f.zona ? String(f.zona).trim() : "(por revisar)";
  let t = tel(f.telefono);
  let notaTel = "";
  if (t.length !== 9) {
    notaTel = ` [teléfono ficha: ${String(f.telefono ?? "vacío")}]`;
    t = null;
  }
  // Antiduplicado por teléfono (global, activos).
  if (t) {
    const dup = rw.prepare("SELECT nombre,apellido FROM Visitante WHERE telefono=? AND activo=1").get(t);
    if (dup) {
      omitidos.push(`${nombre} ${apellido}: teléfono ya existe (${dup.nombre} ${dup.apellido})`);
      continue;
    }
  }
  const sin = f.aceptaComunicaciones === false || f.aceptaWhatsapp === false;
  const obs = `${sin ? "⛔ No acepta comunicaciones/WhatsApp (ficha). " : ""}Importado de ficha (revisar datos).${notaTel}`;
  if (!confirmado) {
    creados++;
    continue;
  }
  const id = uid();
  insV.run(id, nombre, apellido, zona, t, EDAD[f.rangoEdad] ?? null,
    f.codigoPostal ? String(f.codigoPostal) : null, null, null,
    Array.isArray(f.ayudas) && f.ayudas.length ? f.ayudas.join("; ") : null,
    obs, "DESEA_SER_CONTACTADO", sin ? 1 : 0, IGLESIA.id, null, null, ORIGEN?.id ?? null);
  insH.run(uid(), id, "Importado de ficha primera visita");
  creados++;
}
console.log(confirmado ? `Creados en local (Barcelona): ${creados}` : `Simulacro: se crearían ${creados}`);
for (const o of omitidos) console.log(` - omitido: ${o}`);
