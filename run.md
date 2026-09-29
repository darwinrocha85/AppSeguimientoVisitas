# Ejecutar en consola local (Windows PowerShell)

> Usa `npm.cmd` en lugar de `npm` si tu PowerShell bloquea la ejecución de scripts.

## 1. Instalar dependencias (solo la primera vez)

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
```

## 2. Variables de entorno (solo la primera vez)

```powershell
Copy-Item .env.example .env
```

Revisa `.env`: `DATABASE_URL="file:./dev.db"` y `JWT_SECRET` con un valor propio.

## 3. Base de datos local (solo la primera vez o si cambia `prisma/schema.prisma`)

```powershell
& "C:\Program Files\nodejs\npx.cmd" prisma db push
& "C:\Program Files\nodejs\npx.cmd" prisma generate
```

## 4. Crear superadmin + datos ficticios (solo la primera vez)

```powershell
$env:DATABASE_URL="file:./dev.db"
node prisma/seed.mjs
```

- Usuario: `SuperAdmin` / Contraseña: `Admin1234`
- Para otros valores: `$env:SEED_SUPERADMIN="otro"; $env:SEED_PASSWORD="otraClave123"`
- El seed crea 4 iglesias (Central, Norte, Sur, Este), pastor.juan, lider.maria, líderes de red/grupo, 2 consolidadores y 6 visitantes con historial.
- Usuarios ficticios (clave `Visita123`): `pastor.juan`, `lider.maria`, `lider.familias`, `lider.gracia`, `conso.diego`, `conso.luz`.
- Para regenerar desde cero: borra `prisma/dev.db`, repite pasos 3 y 4.

## 5. Servidor de desarrollo

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Abre http://localhost:3000 (redirige a `/ingresar`).
## 6. Verificaciones

```powershell
& "C:\Program Files\nodejs\npm.cmd" run typecheck
& "C:\Program Files\nodejs\npm.cmd" run lint
& "C:\Program Files\nodejs\npm.cmd" run build
```

## 7. Servidor de producción local (después del build)

```powershell
& "C:\Program Files\nodejs\npm.cmd" run start -- -p 3100
```

## Notas

- Base local: SQLite en `prisma/dev.db`. Para producción en Vercel se usa PostgreSQL administrado (ver `prisma/schema.prisma`).
- No hacer commit ni despliegues sin autorización.
