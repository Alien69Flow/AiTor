# Auditoría de dependencias (npm audit)

Estado medido el 2026-10-16 en este repositorio, con `package-lock.json` regenerado con
**npm 10.9.4 (Node 22)** — el mismo npm que usa CI y Vercel.

| Recuento | Antes | Después |
| --- | --- | --- |
| total | 54 | 23 |
| critical | 2 | **0** |
| high | 41 | 16 |
| moderate | 10 | 7 |
| low | 1 | 0 |

Comandos:

```bash
npm audit --json > audit-before.json   # 54 / 2 / 41 / 10 / 1
# editar package.json (bumps + overrides) y regenerar el lockfile con npm 10
npx npm@10.9.4 install --no-audit --no-fund
npm audit                               # 23 / 0 / 16 / 7 / 0
```

## Qué se arregló

Actualizaciones de rangos de dependencias directas (mismo major):

- `postcss` `^8.5.6` → `^8.5.23` (resuelto 8.5.30). Necesario por **tres** avisos de
  `sourceMappingURL` encadenados: `GHSA-6g55-p6wh-862q` (corregido en 8.5.12),
  `GHSA-r28c-9q8g-f849` (8.5.18) y la corrección incompleta `GHSA-fxqj-rqcc-2cmp` /
  `CVE-2026-69153` (8.5.23). **8.5.18 no basta.**
- `vite` `^5.4.19` → `^5.4.21` (última 5.4.x publicada).
- `react-router-dom` `^6.30.1` → `^6.30.6`.
- `typescript-eslint` `^8.38.0` → `^8.71.2`.

Overrides para dependencias transitivas (solo parches dentro del mismo major; los
paquetes que conviven en varios majors usan claves `paquete@rango` para no romper a ninguno):

`brace-expansion@^1→1.1.21`, `brace-expansion@^2→2.1.7` (uno global rompería a uno de los dos),
`minimatch@^3→3.1.4`, `minimatch@^9→9.0.7`, `nanoid@^3→3.3.18`, `picomatch@^2→2.3.2`,
`postcss-selector-parser@^6→6.1.3`, `source-map-js@^1.2.2`, `rollup@^4.59.0`, `ws@^8→8.22.0`,
`yaml@^2.8.3`, `js-yaml@^4.3.2`, `flatted@^3.4.4`, `fflate@^0.8.3`, `qs@^6.16.1`,
`proxy-addr@^2.0.8`, `fast-uri@^3.1.8`, `hono@^4.13.13`, `ip-address@^10.7.4`,
`browserslist@^4.28.7`, `dompurify@^3.4.17`, `glob@^10.5.0`, `lodash@^4.18.1`,
`@humanfs/node@^0.16.8`, `ajv@^6→6.14.0`, `ajv@^8→8.20.0`.

El único **critical** restante tras los overrides estaba en la cadena de `@vercel/node`
(devDependency, solo tipos): `tar@6.2.1`. Se fuerza `tar@^6 → 7.5.21` para cerrarlo.
`@mapbox/node-pre-gyp` no se ejecuta en este proyecto (no hay módulos nativos), por lo que
el salto de major no cambia el comportamiento.

Tras los cambios: `npm run typecheck`, `npm run build` y `npm ci` (npm 10 **y** npm 11)
pasan; los ficheros nuevos/modificados pasan `eslint` sin errores.

## Qué NO se arregla (y por qué)

Ninguno de estos tiene parche aplicable sin un **major**, o no tiene parche en absoluto.
No se han forzado.

### `@vercel/node` 3.x → 24 (una sola migración cierra 11 de los 23)

`@vercel/node` es `devDependency` y solo aporta los tipos `VercelRequest`/`VercelResponse`
de `api/*.ts`; su árbol transitivo no se ejecuta en el build ni en producción. Su cadena
es el mayor foco restante:

- `tar` (ya forzado a 7.5.21), `@fastify/busboy` (`GHSA-x8mw-p69m-v3mx`, `GHSA-gxm5-99cw-xjw9`),
  `@vercel/nft`, `@vercel/static-config`, `ts-morph`, `@ts-morph/common`, `fast-glob`,
  `path-to-regexp` (`GHSA-9wv6-86v2-598j`), `undici` (15 avisos) y `esbuild` (`GHSA-67mh-4wv8-2f99`).

Recomendación: subir `@vercel/node` a `^24` como cambio aparte y verificar los dos
handlers de `api/`. No se ha hecho aquí para no forzar un major sin revisión.

### `tailwindcss` 3 (requiere Tailwind 4)

Arrastra `chokidar`, `braces`, `micromatch` y `fast-glob`:

- `braces` `GHSA-vfj7-8cjw-p6xm` afecta a `<=3.0.3` y **3.0.3 es la última publicada**:
  no existe versión parcheada. Solo desaparece migrando a Tailwind 4 (que ya no usa esa cadena).
- `lovable-tagger` y `@tailwindcss/typography` se marcan por la misma cadena.
  El "fix" que sugiere npm (`@tailwindcss/typography@0.5.4`) es en realidad un *downgrade*;
  no se aplica.

### `postcss-selector-parser` `GHSA-rj75-hqrm-r3gf` (`<7.1.6`)

Aparece vía `tailwindcss`, `postcss-nested` y `@tailwindcss/typography`, todos los cuales
piden `^6`. Se ha forzado `6.1.3` (que cierra el otro aviso, `GHSA-w9m9-85wc-3x92`), pero el
de complejidad cuadrática requiere la rama 7, que esos consumidores no aceptan. Es un DoS de
CPU en tiempo de build con entrada del propio desarrollador, no de usuarios finales.

### `vite` 5.x — dos avisos sin parche en la rama 5

- `GHSA-fx2h-pf6j-xcff` / `CVE-2026-53571` (`server.fs.deny` bypass, **solo Windows**) y
  `GHSA-v6wh-96g9-6wx3` (`launch-editor`, NTLMv2, **solo Windows**): el parche está en
  **6.4.3+**; la rama 5.x no lo tiene. Afectan únicamente al servidor de desarrollo
  (`npm run dev`) y exigen Windows + red del dev server expuesta. El sitio publicado no
  los usa. Migrar a Vite 6 es un cambio aparte (compatibilidad con `vite-plugin-cesium`
  y `@vitejs/plugin-react-swc`).
- `esbuild` `GHSA-67mh-4wv8-2f99` / `GHSA-g7r4-m6w7-qqqr`: mismo caso, dev server.

### `react-router` / `react-router-dom` (`GHSA-wrjc-x8rr-h8h6`, `GHSA-337j-9hxr-rhxg`)

Ambos se parchean solo en **7.18.0** (`>=6.0.0 <7.18.0` afectado). Se ha subido a 6.30.6,
que cierra los dos avisos de mayor severidad (`GHSA-9jcx-v3wj-wh4m`, `GHSA-2j2x-hqr9-3h42`).
Los dos restantes son inyección de constructor en *SSR hydration* (no aplica: la app es
SPA cliente) y un open-redirect por backslash en `<Link>`. Migrar a React Router 7 es un
cambio aparte.

### `@lovable.dev/mcp-js` → `@modelcontextprotocol/sdk` `GHSA-6qxp-vccf-f47h`

Sin parche disponible en el rango instalado. Desaparece con la salida de Lovable
(ver `docs/lovable-supabase-migration.md`).

## Regla

`npm audit` **no** está en 0 a propósito: 23 avisos no tienen arreglo sin forzar un major o
no tienen parche publicado. El job `audit` de CI falla **solo** con advisories `critical`,
que hoy son 0.
