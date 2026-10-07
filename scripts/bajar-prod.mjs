// Trae prod a local (bajar-produccion) usando .env.production.seed sin mostrar claves.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const env = {};
for (const line of fs.readFileSync(".env.production.seed", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
}
const r = spawnSync("node", ["scripts/bajar-produccion.mjs", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    PROD_DATABASE_URL: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL,
    DATABASE_URL: "file:./dev.db",
  },
});
process.exit(r.status ?? 1);
