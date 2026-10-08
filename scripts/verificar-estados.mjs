import fs from "node:fs";
import pg from "pg";
const env = {};
for (const line of fs.readFileSync(".env.production.seed", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
}
const prod = new pg.Client({ connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await prod.connect();
const e = await prod.query('SELECT "estadoActual", count(*) c FROM "Visitante" WHERE activo=true GROUP BY 1 ORDER BY 1');
console.log("PROD estados:", JSON.stringify(e.rows));
const h = await prod.query(`SELECT "aEstado", count(*) c FROM "VisitanteHistorial" WHERE "fechaCambio" >= now() - interval '2 days' GROUP BY 1`);
console.log("PROD historial 2d:", JSON.stringify(h.rows));
const s = await prod.query('SELECT count(*) c FROM "Visitante" WHERE activo=true AND "sinContacto"=true');
console.log("PROD sinContacto:", s.rows[0].c);
await prod.end();
