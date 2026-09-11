# Changelog

Registro técnico de cada release a producción, basado en
[Keep a Changelog](https://keepachangelog.com/es-AR/1.1.0/). La versión para
usuarios y clientes es [NOVEDADES.md](NOVEDADES.md).

Los headers de las entradas son anclas de `.github/workflows/release-tags.yml`,
que extrae de acá las notas de cada GitHub Release: no cambiar su formato. El
contrato completo (entrada de release, sección pendiente de staging y su
conversión) está en `.claude/skills/deploy/SKILL.md` ("Contrato de formato").

## Sin publicar
<!-- sincronizado-hasta: 5563f0a #437 -->

### Web

#### Agregado
- Pantalla `/novedades` con `NOVEDADES.md` horneado, versión + dot de no visto en el sidebar y acción en ⌘K (#335)
- Filtro del dashboard por parcela, con todas las parcelas en la tira (#332)
- Sección "En pruebas" en `/novedades`, solo en entorno de pruebas, y skill `/novedades` (#376, #415)
- Teclas Inicio/Fin en ⌘K y en el selector de técnico (#402)

#### Cambiado
- Rediseño del detalle de plantación: cabecera única, menú Exportar, % por especie, riel de parcelas y Configuración reorganizada (#344, #358, #363, #365, #371, #420, #435)
- Detalle de árbol en panel lateral en lugar de modal (#350, #420)
- Especies y Usuarios con panel lateral; filtro de uso y orden, búsqueda y columna Alta (#348, #363, #408, #420, #424, #432)
- Listado de Plantaciones con toolbar compacta, búsqueda y filtro de temporada; se quita el filtro por fecha de creación (#352, #363, #424)
- Árboles: Grupo y Foto como filtros; se quitan los chips de alcance y el recuento de la toolbar (#356, #425)
- Selector de técnico con email y buscador, sin "Rol en plantación" (#374, #402)
- Capa responsive ≤900/≤600 px: topbar compacta, acciones del detalle en menú «⋯», columnas `fueraEnMovil`, `--page-pad-x` fluido y modales a ancho completo (#361, #363, #365, #367)
- El rol admin se muestra como "Administrador" en Usuarios, selectores de rol y Configuración; ⌘K muestra la etiqueta del rol en vez del valor crudo (#432)

#### Corregido
- Plantaciones vacías al loguear: `CommandMenuProvider` pasa a `AppLayout` y deja de cachear `[]` como anon (#341)
- La cache de queries se descarta al cambiar de usuario o cerrar sesión (#342)
- "Asignar técnico" ya no ofrece admins ni permite asignar un técnico como Admin (#374)
- `admin-users` mapea el rate limit de Auth a 429 accionable al crear y reenviar invitaciones (#330)
- GPS: la frecuencia exacta se persiste al blur/Enter (#311)
- El logo del sidebar ya no se estira (#329)
- CSV/Excel omiten el nombre de parcelas eliminadas (#311)
- ⌘K: las acciones se encuentran sin tildes (#402)
- ⌘K sin texto: un solo encabezado (Recientes o Sugerencias), spinner mientras carga y aviso neutro si no hay nada (#423)
- Recuentos en singular con una unidad y con separador de miles (`SUSTANTIVO`, `pluralizar`/`concordar`) (#424, #435)
- Invalidaciones faltantes: editar una especie refresca catálogo, dashboard, mapa y Árboles; asignar un técnico, Usuarios; editar, dar de alta o desactivar a una persona, los perfiles (#408)
- Un perfil sin nombre se muestra con su id corto en el sidebar, Árboles y ⌘K (#432)
- Árboles: `?parcela=` de otra plantación o `?gps=`/`?foto=` desconocidos en la URL ya no dejan un filtro fantasma (#425)

### Mobile

#### Agregado
- Revocación de acceso: el pull chequea la membresía antes del replace, devuelve "sin acceso", conserva los datos locales y saltea el push (#318, #334)

#### Cambiado
- Alta de plantación local-first en una transacción, con push inmediato best-effort; se retiran el rollback remoto y la migración 031 (#313, #320)
- Ajustes y Perfil con `CustomHeader` y safe-area (#337)

#### Corregido
- El KML omite el nombre de parcelas eliminadas (#331)

### Otros
- Migración 030: hardening, índices y NOT NULL; suite pgTAP y re-baseline 001–029 (#313)
- Migración 032: reglas de negocio en SQL, contratos compartidos `contracts/*.json`, "Generar IDs" vía RPC (#316)
- Migraciones 033 y 034: SELECT y storage por membresía y organización; admin y superadmin leen las plantaciones de su organización, lo que permite el alta con RETURNING (#318, #383)
- Franja "Entorno de pruebas" con versión y commit en la web de pruebas y Bayka TEST, con el commit calculado en un script compartido por web y mobile; en prod no se genera (#290, #322, #346, #399)
- El build web falla si la URL y la anon key de Supabase no son coherentes (#270)
- Modo demo `npm run dev:demo` sin backend: el cliente falso resuelve embebidos, filtros, `.or()` y `limit`/`range`, con árboles de muestra en todas las plantaciones y conteos por parcela (#354, #399, #406, #418)
- Auditoría de código: comentarios concisos, estilos a `.styles.ts`, deduplicación y tests (#311, #327)
- `NOVEDADES.md` público y `/deploy` que genera los dos changelogs (#280)
- CR de optimización: claves de query y rutas centralizadas, tokens y CSS compartido, listados, detalle, ⌘K y Usuarios en funciones de ≤20 líneas, y tests frágiles corregidos (#396, #398, #417, #420, #422, #424, #425, #427, #432, #433, #436, #437)
- Auditoría responsive `npm run audit:responsive` en módulos, con el detalle de lo que empeora, la métrica de texto que se sale de su caja y `/novedades` con los pasos desplegados (#407, #415, #419)
- CI: ESLint de mobile, lint de los scripts de la raíz y de la auditoría, y `prettier --check` en web (#404, #411, #414, #419, #436, #437)

## 2026-09-01 · web 1.1.0

### Web 1.1.0

#### Agregado
- Ojito para ver la contraseña en login y formularios de password (#266)

#### Corregido
- `_redirects` para SPA fallback en Cloudflare Pages

### Otros
- Variante TEST de la app mobile: build local por variante, ícono con "TEST" e
  instalable junto a la de producción, apuntando a staging (#253)
- Keep-alive periódico de la API de Supabase (staging y prod) para evitar la
  pausa por inactividad del free tier (#284)
- Sistema de releases: versionado por app, CHANGELOG, skill `/deploy` y workflow de tags (#273)
- Flujo de branches staging→main, saneamiento de artefactos y trazabilidad en el board

## 2026-08-20 · web 1.0.0 · mobile 1.0.0

Baseline del sistema de versionado (#273): ambas apps arrancan en 1.0.0 sobre
el estado de producción vigente.

### Web 1.0.0

- Versión inicial versionada: gestión web (Vite + React) en Cloudflare Pages.

### Mobile 1.0.0 (versionCode 1)

- Versión inicial versionada: app Android (Expo), distribución por APK local.
