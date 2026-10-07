import fs from "node:fs";
import pg from "pg";

const env = {};
for (const line of fs.readFileSync(".env.production.seed", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
}
const prod = new pg.Client({
  connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await prod.connect();
const v = await prod.query("SELECT count(*) c FROM \"Visitante\" WHERE activo=true");
const u = await prod.query("SELECT count(*) c FROM \"Usuario\" WHERE activo=true");
const b = await prod.query("SELECT count(*) c FROM \"Visitante\" WHERE activo=true AND \"iglesiaId\"=(SELECT id FROM \"Iglesia\" WHERE nombre LIKE '%Barcelona%' LIMIT 1)");
console.log(`prod visitantes activos: ${v.rows[0].c}, usuarios activos: ${u.rows[0].c}, en Barcelona: ${b.rows[0].c}`);
await prod.end();
