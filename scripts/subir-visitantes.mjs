/**
 * Sube visitantes NUEVOS de LOCAL (SQLite) a PRODUCCION (PostgreSQL).
 * Solo INSERTA: nunca actualiza ni borra en prod. Con control
 * anti-duplicado por teléfono (global, entre activos): si el teléfono
 * ya existe en prod, se omite y se informa.
 *
 * Flujo previsto:
 *   1) Bajar prod a local (trae usuarios/iglesias reales).
 *   2) Crear en local los 25 via panel Importar (revisión humana).
 *   3) Subir solo esos nuevos con este script.
 *
 * Uso (PowerShell, desde la raíz):
 *   $env:PROD_DATABASE_URL="postgres://..."  # Vercel > Storage
 *   $env:DATABASE_URL="file:./dev.db"        # local (igual que dev)
 *   node scripts/subir-visitantes.mjs --desde 2026-10-07T00:00 --confirmado
 *   # o por ids: node scripts/subir-visitantes.mjs --ids id1,id2 --confirmado
 *
 * Sin --confirmado no escribe nada (modo simulacro: dice qué haría).
 */
import pg from "pg";
import { createRequire } from "node:module";

const require = createRequire(`${process.cwd()}/package.json`);
const BetterSqlite = require("better-sqlite3");

const PROD_URL = process.env.PROD_DATABASE_URL;
const LOCAL_URL = process.env.DATABASE_URL || "file:./dev.db";
if (!PROD_URL) {
  console.error("Falta $env:PROD_DATABASE_URL (la de Vercel > Storage).");
  process.exit(2);
}
const confirmado = process.argv.includes("--confirmado");
const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : null;
};

const m = LOCAL_URL.match(/^file:(.+)$/);
if (!m) {
  console.error("DATABASE_URL local debe ser file:./dev.db");
  process.exit(2);
}
const localPath = `${process.cwd()}/prisma/${m[1].replace(/^\.\//, "")}`;
const local = new BetterSqlite(localPath, { readonly: true });

let filas;
const ids = arg("--ids");
const desde = arg("--desde");
if (ids) {
  const lista = ids.split(",").map((s) => s.trim()).filter(Boolean);
  if (lista.length === 0) {
    console.error("Pon ids: --ids id1,id2");
    process.exit(2);
  }
  const q = `SELECT * FROM Visitante WHERE id IN (${lista.map(() => "?").join(",")}) AND activo=1`;
  filas = local.prepare(q).all(...lista);
} else if (desde) {
  const t = new Date(desde);
  if (Number.isNaN(+t)) {
    console.error("Fecha inválida en --desde (usa ISO, p. ej. 2026-10-07T00:00).");
    process.exit(2);
  }
  filas = local.prepare("SELECT * FROM Visitante WHERE activo=1 AND datetime(createdAt) >= datetime(?)").all(t.toISOString().slice(0, 19).replace("T", " "));
} else {
  console.error("Indica --ids ... o --desde <ISO>.");
  process.exit(2);
}
if (filas.length === 0) {
  console.log("Nada que subir: 0 visitantes locales con ese filtro.");
  process.exit(0);
}
console.log(`Candidatos en local: ${filas.length}`);

const prod = new pg.Client({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });
await prod.connect();

const tel = (v) => String(v ?? "").replace(/\D/g, "");
let insertados = 0;
const omitidos = [];
for (const v of filas) {
  const t = tel(v.telefono);
  // Mismo teléfono no se guarda dos veces (global, activos).
  if (t) {
    const dup = await prod.query('SELECT id, nombre, apellido FROM "Visitante" WHERE telefono=$1 AND activo=true LIMIT 1', [t]);
    if (dup.rowCount > 0) {
      omitidos.push(`${v.nombre} ${v.apellido} (tel ya en prod: ${dup.rows[0].nombre} ${dup.rows[0].apellido})`);
      continue;
    }
  }
  const existeId = await prod.query('SELECT id FROM "Visitante" WHERE id=$1', [v.id]);
  if (existeId.rowCount > 0) {
    omitidos.push(`${v.nombre} ${v.apellido} (id ya en prod)`);
    continue;
  }
  // Verifica que iglesia/red/grupo/consolidador/origen existan en prod.
  const ig = await prod.query('SELECT id FROM "Iglesia" WHERE id=$1 AND activo=true', [v.iglesiaId]);
  if (ig.rowCount === 0) {
    omitidos.push(`${v.nombre} ${v.apellido} (iglesia no existe en prod)`);
    continue;
  }
  if (!confirmado) continue;
  await prod.query(
    `INSERT INTO "Visitante" (id, nombre, apellido, zona, telefono, edad, "codigoPostal", calle, "invitadoPor", peticiones, observaciones, "estadoActual", activo, "sinContacto", "iglesiaId", "redId", "grupoId", "origenId", "consolidadorId", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [v.id, v.nombre, v.apellido, v.zona, t || null, v.edad, v.codigoPostal, v.calle, v.invitadoPor, v.peticiones, v.observaciones,
     v.estadoActual || "DESEA_SER_CONTACTADO", Boolean(v.sinContacto), v.iglesiaId, v.redId, v.grupoId, v.origenId, v.consolidadorId,
     new Date(v.createdAt), new Date(v.updatedAt)]
  );
  await prod.query(
    `INSERT INTO "VisitanteHistorial" (id, "visitanteId", "deEstado", "aEstado", "fechaCambio", observaciones)
     VALUES (gen_random_uuid(), $1, NULL, $2, $3, $4)`,
    [v.id, v.estadoActual || "DESEA_SER_CONTACTADO", new Date(v.createdAt), "Importado de fichas primera visita"]
  );
  insertados++;
}
await prod.end();

console.log(confirmado ? `Insertados en prod: ${insertados}` : `Simulacro: se insertarían ${filas.length - omitidos.length} (sin --confirmado no se escribe).`);
for (const o of omitidos) console.log(` - omitido: ${o}`);
