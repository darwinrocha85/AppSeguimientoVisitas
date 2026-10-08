# Runbook — AppSeguimientoVisitas

Seguimiento de visitantes de primera visita (iglesia > red > grupo).
Next.js + TypeScript + PWA. Interfaz en español.
Local: SQLite (`prisma/dev.db`). Producción (Vercel): PostgreSQL administrado.

> En PowerShell usa `npm.cmd` en lugar de `npm` si se bloquea la ejecución
> de scripts. Todos los comandos desde la raíz del proyecto.

## 1. Puesta en marcha local (primera vez)

```powershell
Set-Location -LiteralPath "C:\Users\sebas\Documents\Projects\AppSeguimientoVisitas"
& "C:\Program Files\nodejs\npm.cmd" install
Copy-Item .env.example .env
```

Revisa `.env`: `DATABASE_URL="file:./dev.db"` y `JWT_SECRET` propio.

```powershell
& "C:\Program Files\nodejs\npx.cmd" prisma db push
& "C:\Program Files\nodejs\npx.cmd" prisma generate
```

Seed inicial (crea superadmin + datos de ejemplo; las claves se definen en
la sesión con `$env:` y no se publican):

```powershell
$env:DATABASE_URL="file:./dev.db"
$env:SEED_PASSWORD="..."
$env:SEED_DEMO_PASSWORD="..."
node prisma/seed.mjs
```

- Solo superadmin sin datos de ejemplo: `$env:SKIP_DEMO="1"` antes del seed.
- Regenerar desde cero: borra `prisma/dev.db` (y `dev.db-journal` si existe)
  y repite `db push` + seed.

## 2. Uso diario

```powershell
Set-Location -LiteralPath "C:\Users\sebas\Documents\Projects\AppSeguimientoVisitas"
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Abre http://localhost:3000 (redirige a `/ingresar`).

## 3. Verificaciones (antes de commit)

```powershell
& "C:\Program Files\nodejs\npm.cmd" run typecheck
& "C:\Program Files\nodejs\npm.cmd" run lint
& "C:\Program Files\nodejs\npm.cmd" run build
```

Servidor de producción en local (tras el build):

```powershell
& "C:\Program Files\nodejs\npm.cmd" run start -- -p 3100
```

## 4. Sincronizar con producción

Los wrappers leen `.env.production.seed` sin mostrar claves (ese archivo
nunca se commitea). Bajar reemplaza lo local con respaldo automático.
Subir solo inserta visitantes nuevos (antiduplicado por teléfono).

```powershell
node scripts/bajar-prod.mjs --confirmado
node scripts/verificar-prod.mjs
node scripts/subir-prod.mjs --desde 2026-10-07T00:00
node scripts/subir-prod.mjs --desde 2026-10-07T00:00 --confirmado
```

Sin `--confirmado` es simulacro (no escribe).

## 5. Importar fichas escaneadas (solo local)

```powershell
node scripts/importar-fichas-local.mjs
node scripts/importar-fichas-local.mjs --confirmado
```

Lee las lecturas de `Temp/opencode/fichas/lecturas.json`, crea en la
iglesia indicada con origen “1ra visita iglesia” (omite ilegibles y
teléfonos ya existentes). Con respaldo de `dev.db`.

## 6. Envío puntual de WhatsApp (móvil de la iglesia)

Primero bajar prod (paso 4). La primera vez muestra un QR: escanéalo con
el móvil de la iglesia (WhatsApp > Dispositivos). La sesión queda en
`wa-sesion/` (ignorada por git).

```powershell
node scripts/enviar-whatsapp.mjs --iglesia Barcelona --limite 3
node scripts/enviar-whatsapp.mjs --solo 6XXXXXXXX --nombre Nombre --confirmado
node scripts/enviar-whatsapp.mjs --iglesia Barcelona --confirmado
```

Sin `--confirmado` es simulacro. Respeta “Recibe WhatsApp = No”, deja
`envios-*.log` (solo ids) y pausa 8–15s entre mensajes. Al enviar, quien
estaba en “Desea ser contactado” avanza a primer contacto en prod (con
historial y fecha de contacto); después corre `bajar-prod`. La plantilla está
en `plantillas/oracion-intercesion.txt` (`{nombre}`, `{iglesia}`).

## 7. Deploy

Push a `main` y Vercel despliega solo:

```powershell
git push origin main
```

Variables necesarias en Vercel: `DATABASE_URL` (PostgreSQL), `JWT_SECRET`,
`AI_GATEWAY_API_KEY` (lectura de fichas) y `AI_GATEWAY_MODEL`.
Esquema de prod: `prisma/schema.production.prisma`.

## 8. Funciones verificables en local

- **Tiempos de alerta:** pastor → Dashboard → iglesia → “Tiempos de alerta”,
  horas por transición (1 a 2160).
- **No asignados:** tab que ignora la cascada; reasigna con Asignar/Editar.
- **Importar:** Visitantes → Importar (foto, máx 5): solo pre-rellena.
- **Radio WhatsApp:** Nuevo/Editar → “¿Recibe WhatsApp? Sí/No” (defecto Sí);
  el No oculta el botón y excluye de envíos.
- **Orden:** Visitantes en alfabético estable (es).

## Problemas comunes

- `Falta SEED_PASSWORD en el entorno`: define las 3 `$env:` del seed.
- Puerto 3000 ocupado: `run start -- -p 3100` (o cierra el otro `dev`).
- Base corrupta o vieja: borra `prisma/dev.db` y repite paso 1.
- `El lector falló / saturado`: revisa `AI_GATEWAY_API_KEY` y reintenta.
- Sesión WhatsApp cerrada: borra `wa-sesion/` y vuelve a escanear el QR.
