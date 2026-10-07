// Carga la URL de prod desde .env.production.seed (sin mostrarla) y
// ejecuta scripts/subir-visitantes.mjs con los mismos argumentos.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const env = {};
for (const line of fs.readFileSync(".env.production.seed", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
}
const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
if (!url) {
  console.error("Sin URL de prod en .env.production.seed");
  process.exit(2);
}
const r = spawnSync("node", ["scripts/subir-visitantes.mjs", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, PROD_DATABASE_URL: url, DATABASE_URL: "file:./dev.db" },
});
process.exit(r.status ?? 1);
