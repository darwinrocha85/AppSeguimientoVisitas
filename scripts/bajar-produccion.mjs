/**
 * Baja la base de PRODUCCION (PostgreSQL) a LOCAL (SQLite).
 * Produccion es la verdad: lo local se REEMPLAZA por completo.
 *
 * Solo LEE de produccion (SELECT). Nunca escribe alla.
 *
 * Uso (PowerShell, desde la raiz del proyecto):
 *   $env:PROD_DATABASE_URL="postgres://..."   # ver Vercel > Storage
 *   $env:DATABASE_URL="file:./dev.db"          # tu local (igual que seed/dev)
 *   node scripts/bajar-produccion.mjs --confirmado
 *
 * Sin --confirmado no hace nada. Antes de borrar, respalda dev.db a
 * prisma/dev.db.respaldo-<fecha>. No commitear *.db (ya ignorados).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PrismaClient } from "@prisma/client";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROD_URL = process.env.PROD_DATABASE_URL;
const LOCAL_URL = process.env.DATABASE_URL || "file:./dev.db";

if (!PROD_URL) {
  console.error("Falta $env:PROD_DATABASE_URL (la de Vercel > Storage, solo lectura).");
  process.exit(2);
}
if (!process.argv.includes("--confirmado")) {
  console.error("Por seguridad agrega --confirmado: lo local se reemplaza por completo.");
  process.exit(2);
}

// Orden hijo->padre para borrar; inverso para insertar.
const TABLAS = [
  "VisitanteHistorial",
  "Visitante",
  "Origen",
  "AlertaConfig",
  "UsuarioIglesia",
  "Grupo",
  "Red",
  "Usuario",
  "Iglesia",
];

const prod = new pg.Client({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });
await prod.connect();

// Verifica que produccion tenga las tablas esperadas (mismo esquema).
const existe = await prod.query(
  "SELECT tablename FROM pg_tables WHERE schemaname='public'"
);
const tablasProd = new Set(existe.rows.map((r) => r.tablename));
for (const t of TABLAS) {
  if (!tablasProd.has(t)) {
    console.error(`Produccion no tiene la tabla "${t}". Abortado sin tocar nada.`);
    await prod.end();
    process.exit(3);
  }
}

// Lee todo de produccion.
const datos = {};
for (const t of TABLAS) {
  const r = await prod.query(`SELECT * FROM "${t}"`);
  datos[t] = r.rows;
  console.log(`${t}: ${r.rows.length} en produccion`);
}
await prod.end();

// Respaldo de lo local antes de tocarlo.
process.env.DATABASE_URL = LOCAL_URL;
const m = LOCAL_URL.match(/^file:(.+)$/);
if (m) {
  const localPath = path.resolve(RAIZ, "prisma", m[1].replace(/^\.\//, ""));
  if (fs.existsSync(localPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const bak = `${localPath}.respaldo-${stamp}`;
    fs.copyFileSync(localPath, bak);
    console.log(`Respaldo local: ${path.basename(bak)}`);
  }
}

const db = new PrismaClient();
// SQLite + FK: borra e inserta en orden seguro.
const modelos = {
  VisitanteHistorial: db.visitanteHistorial,
  Visitante: db.visitante,
  Origen: db.origen,
  AlertaConfig: db.alertaConfig,
  UsuarioIglesia: db.usuarioIglesia,
  Grupo: db.grupo,
  Red: db.red,
  Usuario: db.usuario,
  Iglesia: db.iglesia,
};
for (const t of TABLAS) await modelos[t].deleteMany({});
for (const t of [...TABLAS].reverse()) {
  const filas = datos[t];
  if (filas.length === 0) continue;
  // createMany por lotes (SQLite limita variables por sentencia).
  for (let i = 0; i < filas.length; i += 500) {
    await modelos[t].createMany({ data: filas.slice(i, i + 500) });
  }
}

// Verifica conteos finales.
let ok = true;
for (const t of TABLAS) {
  const n = await modelos[t].count();
  const marca = n === datos[t].length ? "OK" : "DIFERENTE";
  if (n !== datos[t].length) ok = false;
  console.log(`${t}: local ${n} / prod ${datos[t].length} ${marca}`);
}
await db.$disconnect();
if (!ok) {
  console.error("Conteos no cuadran: revisa antes de usar.");
  process.exit(4);
}
console.log("Sincronizado: lo local es copia exacta de produccion.");
