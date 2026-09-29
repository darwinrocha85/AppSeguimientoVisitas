# Fases del proyecto

## Hecho

- **Fase 1 — Base:** Next.js + TS + PWA, Prisma (SQLite local, PostgreSQL en prod), auth JWT, paleta de referencia.
- **Fase 2 — Superadmin:** CRUD iglesia/pastor/líder consolidador, asignación máx 2 iglesias, borrado lógico en cascada, teléfono `607 35 00 44`.
- **Fase 3 — Tablero:** carcasa (barra, filtros en cascada con consolidador, tabs), Dashboard, Visitantes (lista+buscador), Usuarios (perfil, dropdown buscador, eliminar lógico), página de iglesia con asignados filtrables.
- **Fase 4 — Reportes:** estadísticas por rango con `fecha_cambio_estado`, % éxito con límites del pastor, evolución con gráfica SVG (series seleccionables) y PDF por impresión.
- **Fase 5 — Demo:** seed con 4 iglesias, redes, grupos, 24 usuarios y 200 visitantes con 90 días de historial (claves en `run.md`).

## Pendiente

- **Fase 6 — Alta de visitantes:** formulario (pastor/líder consolidador) con iglesia/red/grupo/consolidador y origen; asigna historial inicial.
- **Fase 7 — Reporte del consolidador:** confirmar 1er/2do contacto y N visitas de amistad con `fecha_contacto` (vista `view_consolidador.png`).
- **Fase 8 — Alertas:** configurar horas por estado (pastor, por iglesia) y avisos de visitantes vencidos.
- **Fase 9 — Roles operativos:** vistas y permisos finales de líder de red/grupo y consolidador raso.
- **Fase 10 — Producción:** PostgreSQL administrado, variables en Vercel, prueba de instalación PWA en celular, `prisma migrate` en vez de `db push`.

## Reglas de cada fase

- Solo pruebas locales; commit/push solo cuando el usuario lo pida.
- `typecheck` + `lint` + `build` en verde antes de dar por hecha una fase.
- Sin definiciones nuevas de permisos/datos/estadísticas sin confirmar.
