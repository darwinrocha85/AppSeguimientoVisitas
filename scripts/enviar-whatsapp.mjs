/**
 * Envío PUNTUAL de WhatsApp desde el móvil de la iglesia (Baileys).
 * Uso ocasional: vincula una vez por QR y la sesión queda guardada en
 * ./wa-sesion (ignorada por git, no commitear).
 *
 * Lee destinatarios de la DB LOCAL (que debe ser copia de prod: primero
 * node scripts/bajar-prod.mjs --confirmado). Respeta el radio
 * "¿Recibe WhatsApp?": los No (sinContacto) se excluyen siempre.
 * Solo LEE la base; no escribe nada.
 *
 * Prueba a una persona (p. ej. el líder):
 *   node scripts/enviar-whatsapp.mjs --solo 600123456 --nombre Darwin --confirmado
 *
 * Envío real a una iglesia (primero SIN --confirmado = simulacro):
 *   node scripts/enviar-whatsapp.mjs --iglesia Barcelona
 *   node scripts/enviar-whatsapp.mjs --iglesia Barcelona --confirmado
 *
 * Opciones: --mensaje <txt> (plantilla con {nombre} {iglesia}),
 *   --limite N, --solo <tel9> --nombre <N> [--iglesia-nombre <texto>].
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import qrcode from "qrcode-terminal";
import pg from "pg";
import {
  makeWASocket,
  useMultiFileAuthState as multiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";

const require = createRequire(`${process.cwd()}/package.json`);
const BetterSqlite = require("better-sqlite3");

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : null;
};
const confirmado = process.argv.includes("--confirmado");
const plantillaPath = arg("--mensaje") || "plantillas/oracion-intercesion.txt";
const plantilla = fs.readFileSync(plantillaPath, "utf8").trim();
const limite = Number(arg("--limite") || "0") || Infinity;

// --- Destinatarios ---
let lista = [];
if (arg("--solo")) {
  const t = String(arg("--solo")).replace(/\D/g, "");
  if (t.length !== 9) {
    console.error("--solo necesita 9 dígitos.");
    process.exit(2);
  }
  lista = [{
    id: "prueba",
    nombre: arg("--nombre") || "amigo",
    telefono: t,
    iglesia: arg("--iglesia-nombre") || "Iglesia Cuadrangular Barcelona",
  }];
} else {
  const filtro = arg("--iglesia");
  if (!filtro) {
    console.error("Indica --iglesia <texto|todas> o usa --solo para probar.");
    process.exit(2);
  }
  const condIg = filtro.toLowerCase() === "todas" ? "" : "AND i.nombre LIKE '%' || ? || '%'";
  const params = condIg ? [filtro] : [];
  const local = process.env.DATABASE_URL || "file:./dev.db";
  const m = local.match(/^file:(.+)$/);
  const db = new BetterSqlite(`${process.cwd()}/prisma/${m[1].replace(/^\.\//, "")}`, { readonly: true });
  const filas = db.prepare(
    `SELECT v.id, v.nombre, v.telefono, i.nombre AS iglesia
     FROM Visitante v JOIN Iglesia i ON i.id = v.iglesiaId
     WHERE v.activo=1 AND v.sinContacto=0 ${condIg}`
  ).all(...params);
  const excluidos = db.prepare(
    `SELECT count(*) c FROM Visitante v JOIN Iglesia i ON i.id = v.iglesiaId
     WHERE v.activo=1 AND v.sinContacto=1 ${condIg}`
  ).get(...params).c;
  console.log(`Excluidos (Recibe WhatsApp=No): ${excluidos}`);
  lista = filas
    .filter((v) => String(v.telefono ?? "").replace(/\D/g, "").length === 9)
    .map((v) => ({ ...v, telefono: String(v.telefono).replace(/\D/g, "") }));
  console.log(`Sin teléfono válido: ${filas.length - lista.length}`);
}
if (limite !== Infinity) lista = lista.slice(0, limite);
if (lista.length === 0) {
  console.log("Sin destinatarios.");
  process.exit(0);
}
const textoPara = (d) =>
  plantilla.replaceAll("{nombre}", d.nombre).replaceAll("{iglesia}", d.iglesia);

console.log(`Destinatarios: ${lista.length}`);
for (const d of lista.slice(0, 10)) console.log(` - ${d.nombre} (${d.iglesia})`);
if (lista.length > 10) console.log(` ... y ${lista.length - 10} más`);
if (!confirmado) {
  console.log("Simulacro: sin --confirmado no se conecta ni se envía.");
  console.log("Vista previa del primero:");
  console.log(textoPara(lista[0]));
  process.exit(0);
}

// Al enviar, quien estaba en "Desea ser contactado" avanza a primer
// contacto en PROD (con historial y fecha_contacto). Modo --solo (prueba)
// no toca ninguna base.
const esPrueba = lista.length === 1 && lista[0].id === "prueba";
let prod = null;
if (!esPrueba) {
  const env = {};
  for (const line of fs.readFileSync(".env.production.seed", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
  }
  const url = process.env.PROD_DATABASE_URL || env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!url) {
    console.error("Sin conexión a prod: define $env:PROD_DATABASE_URL.");
    process.exit(2);
  }
  prod = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await prod.connect();
}

// --- Conexión (QR solo la primera vez; el servidor puede pedir reinicio) ---
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let sock;
for (let intento = 1; ; intento++) {
  const { state, saveCreds } = await multiFileAuthState("./wa-sesion");
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ["Envio Iglesia", "Chrome", "1.0"],
  });
  sock.ev.on("creds.update", saveCreds);
  const resultado = await new Promise((res) => {
    const t = setTimeout(() => res("timeout"), 60000);
    sock.ev.on("connection.update", (u) => {
      if (u.qr) {
        console.log("Escanea este QR con el móvil de la iglesia (WhatsApp > Dispositivos):");
        qrcode.generate(u.qr, { small: true });
      }
      if (u.connection === "open") {
        clearTimeout(t);
        res("open");
      }
      if (u.connection === "close") {
        const codigo = u.lastDisconnect?.error?.output?.statusCode;
        clearTimeout(t);
        if (codigo === DisconnectReason.loggedOut) res("logout");
        else res(`retry:${codigo ?? "?"}`);
      }
    });
  });
  if (resultado === "open") break;
  if (resultado === "logout") {
    console.error("Sesión cerrada: borra ./wa-sesion y vuelve a escanear.");
    process.exit(5);
  }
  if (intento >= 5 || resultado === "timeout") {
    console.error("No se pudo conectar. Revisa internet y reintenta.");
    process.exit(5);
  }
  console.log(`Reinicio pedido por el servidor (${resultado}), reintentando…`);
  await espera(3000);
}
console.log("Conectado.");

// --- Envío con pausa (cuida la línea: son mensajes ocasionales) ---
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const log = fs.createWriteStream(`envios-${stamp}.log`);
let ok = 0;
let avanzados = 0;
for (const [i, d] of lista.entries()) {
  try {
    await sock.sendMessage(`34${d.telefono}@s.whatsapp.net`, { text: textoPara(d) });
    let marca = "";
    if (prod && d.id !== "prueba") {
      const actual = await prod.query('SELECT "estadoActual" FROM "Visitante" WHERE id=$1', [d.id]);
      if (actual.rows[0]?.estadoActual === "DESEA_SER_CONTACTADO") {
        await prod.query(
          `UPDATE "Visitante" SET "estadoActual"='PRIMER_CONTACTO', "updatedAt"=now() WHERE id=$1`,
          [d.id]
        );
        await prod.query(
          `INSERT INTO "VisitanteHistorial" (id, "visitanteId", "deEstado", "aEstado", "fechaCambio", "fechaContacto", observaciones)
           VALUES (gen_random_uuid(), $1, 'DESEA_SER_CONTACTADO', 'PRIMER_CONTACTO', now(), now(), 'Primer contacto por WhatsApp (época de oración)')`,
          [d.id]
        );
        avanzados++;
        marca = " +1er contacto";
      }
    }
    log.write(`${new Date().toISOString()} ${d.id} OK${marca}\n`);
    ok++;
  } catch (e) {
    log.write(`${new Date().toISOString()} ${d.id} ERROR ${String(e).slice(0, 120)}\n`);
    console.log(`Falló ${d.nombre}: ${String(e).slice(0, 120)}`);
  }
  if (i < lista.length - 1) await espera(8000 + Math.random() * 7000);
}
log.end();
if (prod) await prod.end();
sock.end();
console.log(`Enviados ${ok}/${lista.length}, avanzados a 1er contacto: ${avanzados}. Detalle (solo ids) en envios-${stamp}.log`);
if (avanzados > 0) console.log("Ojo: tu DB local quedó desactualizada: corre bajar-prod para sincronizar.");
