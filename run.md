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
- El seed crea 4 iglesias (Central, Norte, Sur, Este) con sus redes, grupos, pastores, líderes y 200 visitantes con 90 días de historial.
- Para regenerar desde cero: borra `prisma/dev.db`, repite pasos 3 y 4.

## Usuarios de demostración (clave común: `Visita123`)

| Usuario | Contraseña | Rol | Iglesias |
|---|---|---|---|
| SuperAdmin | Admin1234 | Superadmin | Todas |
| pastor.juan | Visita123 | Pastor | Central, Norte |
| pastor.luis | Visita123 | Pastor | Sur, Este |
| lider.maria | Visita123 | Líder consolidador | Central, Norte |
| lider.jose | Visita123 | Líder consolidador | Sur, Este |
| lider.familias | Visita123 | Líder de red | Central (Red Familias) |
| lider.jovenes | Visita123 | Líder de red | Central (Red Jóvenes) |
| lider.norte | Visita123 | Líder de red | Norte |
| lider.sur | Visita123 | Líder de red | Sur |
| lider.redeste | Visita123 | Líder de red | Este |
| lider.gracia | Visita123 | Líder de grupo | Central (Gracia - 101) |
| lider.fe | Visita123 | Líder de grupo | Central (Fe - 102) |
| lider.fuego | Visita123 | Líder de grupo | Central (Jóvenes Fuego) |
| lider.norte201 | Visita123 | Líder de grupo | Norte |
| lider.sur301 | Visita123 | Líder de grupo | Sur |
| lider.este401 | Visita123 | Líder de grupo | Este |
| conso.diego | Visita123 | Consolidador | Central (Gracia - 101) |
| conso.pablo | Visita123 | Consolidador | Central (Fe - 102) |
| conso.luz | Visita123 | Consolidador | Central (Jóvenes Fuego) |
| conso.sara | Visita123 | Consolidador | Central (Jóvenes Fuego) |
| conso.elena | Visita123 | Consolidador | Norte |
| conso.marco | Visita123 | Consolidador | Sur |
| conso.este1 | Visita123 | Consolidador | Este |
| conso.este2 | Visita123 | Consolidador | Este |

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
