/**
 * Pone UNA clave temporal a todos los usuarios activos (menos superadmin)
 * en PRODUCCION. Las claves no se pueden recuperar: se reemplazan.
 *
 * Uso:
 *   $env:PROD_DATABASE_URL="postgres://..."
 *   node scripts/claves-temporal.mjs --clave Bienvenido123 --confirmado
 */
import pg from "pg";
import bcrypt from "bcryptjs";

const PROD_URL = process.env.PROD_DATABASE_URL;
const clave = process.argv[process.argv.indexOf("--clave") + 1];

if (!PROD_URL) {
  console.error("Falta $env:PROD_DATABASE_URL.");
  process.exit(2);
}
if (!clave || clave.length < 6 || !process.argv.includes("--confirmado")) {
  console.error('Uso: node scripts/claves-temporal.mjs --clave <min 6> --confirmado');
  process.exit(2);
}

const prod = new pg.Client({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });
await prod.connect();
const hash = await bcrypt.hash(clave, 10);
const r = await prod.query(
  `UPDATE "Usuario" SET "passwordHash"=$1 WHERE activo=true AND rol<>'SUPERADMIN' RETURNING usuario, rol`,
  [hash]
);
await prod.end();
console.log(`Claves actualizadas en PRODUCCION: ${r.rowCount}`);
for (const u of r.rows) console.log(` - @${u.usuario} (${u.rol})`);
