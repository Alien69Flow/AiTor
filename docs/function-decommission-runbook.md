# Runbook: retirada de Edge Functions

Procedimiento para responder tres preguntas, en este orden: **qué está
desplegado de más**, **si es seguro apagarlo** y **cómo se apaga sin romper
nada**. Escrito para ejecutarse con prisa y sin memoria: cada fase tiene un
comando y un criterio de salida explícito.

Contexto que motiva el documento: `supabase functions deploy` solo sabe añadir.
Una función que se borra del repositorio **sigue desplegada, sigue aceptando
peticiones y conserva su cuota y sus secretos**. El 2026-10-25 había cuatro
funciones así en el proyecto, una de ellas devolviendo información de secretos
a cualquiera (ver "Estado medido").

> Regla de oro: **medir → tumba 410 → esperar → borrar**. Nunca `delete` como
> primer movimiento: el borrado no se puede deshacer y un borrado sin ventana de
> observación convierte un error de inventario en una caída.

---

## Fase 0 · Preparación (5 minutos)

```bash
cd <raíz del repo>
export SUPABASE_PROJECT_REF=wkdtvrxavkhbifjtvvdw      # supabase/config.toml → project_id
export SUPABASE_ACCESS_TOKEN=sbp_...                   # Supabase → Account → Access Tokens
```

El token es de **cuenta**, no la clave publishable: la publishable no puede
listar funciones ni borrarlas. No se escribe en el repo ni en `.env.local`.

Ventana recomendada: laborable, fuera de un despliegue, con el panel
**Edge Functions → Logs** abierto en otra pestaña.

Rollback preparado antes de tocar nada (ver Fase 6): identificar el commit donde
vivía cada función.

```bash
git log --diff-filter=D --name-status --oneline -- supabase/functions
```

---

## Fase 1 · Inventario contra Supabase

### 1a. Lista autoritativa (la única completa)

```bash
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/functions" \
| jq -r '.[] | [.slug, .status, (.version // "?"), (.updated_at // "?")] | @tsv' | sort
```

Equivalente con el CLI, si está instalado:

```bash
npx supabase functions list --project-ref "$SUPABASE_PROJECT_REF"
```

Esta lista incluye funciones que **nunca existieron en este repositorio**
(creadas a mano en el panel o por otra rama), así que es la referencia para
decidir. `status` distingue `ACTIVE` de una función ya desactivada.

### 1b. Diferencia contra el repositorio

```bash
npm run functions:retire            # tabla legible
npm run functions:retire -- --json  # lo mismo, para adjuntar al ticket
```

El script (`scripts/retire-functions.mjs`) cruza cuatro fuentes:

| Fuente | Qué aporta |
| --- | --- |
| `supabase/functions/*/` | lo que el repositorio despliega hoy |
| `supabase/config.toml` | lo declarado (`verify_jwt`); detecta entradas huérfanas |
| API de administración (**con token**) | todas las desplegadas, incluidas las desconocidas |
| Sondas HTTP (**sin token**) | confirma o descarta los nombres del registro |

y clasifica cada nombre como `live`, `not-deployed`, `extra` (desplegada pero
fuera del repo), `already-gone` u `orphanConfig` (declarada sin carpeta).

**Criterio de salida de la fase**: la lista de la columna "DESPLEGADAS FUERA DEL
REPOSITORIO" es el universo de trabajo. Cópiala al ticket; no sigas sin ella.

### 1c. Sin token: sondas y el registro

```bash
npm run functions:retire -- --name sospechosa1,sospechosa2
```

Cada sonda es un `GET /functions/v1/<nombre>` con la clave publishable. La
interpretación **no** es "404 = no existe" a secas:

| Respuesta | Lectura |
| --- | --- |
| `404` + `{"code":"NOT_FOUND","message":"Requested function was not found"}` | no desplegada (respuesta de la plataforma) |
| `404` con otro cuerpo | **ambiguo**: la función existe y devolvió 404 ella misma |
| `401` / `403` | desplegada; la rechaza su propio control de acceso |
| `400` | desplegada; valida la entrada antes de autenticar |
| `405` | desplegada; habla otro protocolo (p. ej. un servidor MCP) |
| `429` | desplegada; rate limit del guard |
| `5xx` | desplegada y rota |

El `404` ambiguo está implementado a propósito: nunca se borra una función por
un falso negativo. Si sale uno, resuélvelo con la lista de 1a.

Sin token **no se pueden descubrir nombres nuevos**. Por eso toda función
retirada se anota en `supabase/functions-retired.json`, la semilla de las
sondas:

```jsonc
{ "name": "mcp", "removedFromRepo": "2026-07-23", "reason": "…", "replacedBy": null }
```

El registro no se poda nunca: es la memoria que permite volver a preguntar por
algo que ya no está en el código.

---

## Fase 2 · Triage: ¿está de más de verdad?

Para cada función de la lista, responder las cinco preguntas. Basta un "sí" para
**no** retirarla:

1. ¿La llama código del repo? `npm run functions:retire` ya lo dice (`todavía se
   llama desde el código: …`). Revisar a mano los casos dudosos:
   ```bash
   grep -rn "<nombre>" src api backend supabase/functions .github --include=*.ts --include=*.tsx --include=*.js --include=*.mjs --include=*.yml
   ```
2. ¿La llama algo fuera del repo? Cron de `pg_cron`, un webhook de terceros, un
   cliente móvil, un `script` de un socio.
   ```sql
   -- SQL Editor (solo lectura)
   select jobid, schedule, command from cron.job;
   ```
3. ¿Sus logs muestran tráfico reciente? Edge Functions → *nombre* → Logs, últimas
   24 h y 7 días. Tráfico real ⇒ **no** es basura, es deuda mal documentada:
   documentarla, no apagarla.
4. ¿Guarda la única copia de alguna lógica o dato? (p. ej. una RPC que ya no
   está en `migrations/`). Si es así, primero se porta la lógica.
5. ¿Tiene secretos propios o permisos elevados? Una función de diagnóstico
   olvidada con `SERVICE_ROLE_KEY` es una brecha, no solo desorden.

Severidad orientativa:

| Situación | Prioridad |
| --- | --- |
| Responde 2xx sin autenticación y devuelve datos internos | **P0**, mismo día |
| Sin consumidores y sin tráfico, con acceso a secretos | P1, esta semana |
| Sin consumidores y sin tráfico, pero con rollback trivial | P2 |
| Con tráfico real | No se retira: se documenta |

---

## Fase 3 · Evidencia antes de apagar

Guardar en el ticket (2 minutos, evita discusiones después):

```bash
# 1. Qué contesta ahora
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/<nombre>"

# 2. Cuándo se desplegó por última vez y con qué verify_jwt
npx supabase functions list --project-ref "$SUPABASE_PROJECT_REF" | grep <nombre>

# 3. Referencias en el repositorio (debe salir vacío en código)
git grep -n "<nombre>" -- ':!docs' ':!supabase/functions-retired.json'
```

Sin `git grep` limpio ⇒ **parar**. La retirada empieza por borrar el consumidor,
no la función.

---

## Fase 4 · Apagado seguro (dos pasos)

### Paso 1 · Tumba 410 (reversible, 10 minutos)

Se sustituye el cuerpo de la función por un `410 Gone` que explica qué pasó. Es
reversible (se redespliega la versión anterior) y hace que cualquier consumidor
que quede falle de forma **ruidosa y legible** en vez de con datos vacíos.

```bash
mkdir -p "supabase/functions/<nombre>"
cat > "supabase/functions/<nombre>/index.ts" <<'EOF'
// Función retirada. Responde 410 para que los consumidores que queden fallen de
// forma explícita en lugar de recibir datos vacíos. Ver
// docs/function-decommission-runbook.md
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  return new Response(
    JSON.stringify({
      error: "gone",
      message: "<nombre> se retiró el <AAAA-MM-DD>. Usa <sustituta o 'ninguna'>.",
      retiredAt: "<AAAA-MM-DD>",
    }),
    { status: 410, headers: { ...CORS, "Content-Type": "application/json", Deprecation: "true" } },
  );
});
EOF

npx supabase functions deploy <nombre> --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt
rm -rf "supabase/functions/<nombre>"        # la tumba vive en producción, no en el repo
```

Verificar:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/<nombre>"
# debe imprimir 410
```

### Paso 2 · Borrado (tras la ventana de observación)

Criterios para borrar, todos a la vez:

- 7 días (48 h si es P0 de seguridad) sin ninguna respuesta `2xx`/`3xx` en los
  logs — la tumba solo debe recibir `410`.
- Ninguna alerta nueva en Analytics ni en el panel de errores.
- `npm run functions:retire` sigue sin referencias de código.

```bash
npx supabase functions delete <nombre> --project-ref "$SUPABASE_PROJECT_REF"
curl -s -o /dev/null -w '%{http_code}\n' "https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/<nombre>"
# 404 de la plataforma = borrada
```

`delete` pide confirmación y no toca la base de datos: las RPC y tablas que
usaba siguen ahí (correcto; se limpian aparte, con su propia migración).

---

## Fase 5 · Higiene posterior

1. **Registro**: añadir la entrada al registro si no estaba (nunca quitarla).
2. **`config.toml`**: borrar el bloque `[functions.<nombre>]`. Si queda sin
   carpeta, `functions:retire` lo marca como `orphanConfig`.
3. **Secretos**: solo los que **solo** usaba esa función.
   ```bash
   grep -rn "NOMBRE_DEL_SECRETO" supabase/functions src api backend   # debe salir vacío
   npx supabase secrets unset NOMBRE_DEL_SECRETO --project-ref "$SUPABASE_PROJECT_REF"
   ```
   `npx supabase secrets list` muestra nombres y hash, nunca valores.
4. **Cron/webhooks**: borrar el job de `cron.job` o el webhook del proveedor.
   Este paso es el que más se olvida y el que genera 401 silenciosos durante
   meses.
5. **Documentación**: `docs/edge-functions.md` (tabla de funciones y de
   secretos), y anotar la sustitución en el registro.
6. **Verificación global**:
   ```bash
   npm run functions:retire -- --strict   # falla si queda alguna de más
   npm run edge:check                     # las 20 vivas siguen respondiendo
   ```

---

## Fase 6 · Rollback

| Situación | Acción |
| --- | --- |
| La tumba rompe un consumidor | Redesplegar la versión anterior (abajo) |
| Borrada por error | Restaurar desde el commit anterior al borrado y desplegar |
| Consumidor externo aparece tarde | Igual que arriba; la tumba dio 7 días de aviso |

```bash
# 1. Localizar la última versión que vivía en el repo
git log --diff-filter=D --oneline -- supabase/functions/<nombre>
# 2. Restaurar esa carpeta (el commit que la borró es el primero de la lista)
git checkout <sha>^ -- "supabase/functions/<nombre>"
# 3. Desplegar y verificar
npx supabase functions deploy <nombre> --project-ref "$SUPABASE_PROJECT_REF"
npm run edge:check
```

Si el borrado ya ocurrió y no hay commit (la función nunca estuvo en el repo),
la única recuperación es el código fuente que tenga el autor; por eso el paso 1a
—inventariar **antes** de borrar— no es opcional.

---

## Fase 7 · Registro de la retirada

```
Función:            <nombre>
Fecha:              <AAAA-MM-DD>
Motivo:             <de más | seguridad | sustituida por X>
Evidencia:          HTTP antes/después, nº de logs en la ventana, salida de functions:retire
Ventana de tumba:   <fechas>
Borrada:            <sí/no, fecha>
Secretos retirados: <lista o "ninguno">
Rollback probado:   <sí/no>
```

---

## Estado medido el 2026-10-25

`npm run functions:retire` (sin `SUPABASE_ACCESS_TOKEN`, sondas reales al
proyecto) devolvió **20 funciones en el repositorio y 4 desplegadas fuera de
él**. `skills-ingest` ya no existe en producción (404 de la plataforma).

| Función | Fuera del repo desde | Sonda | Consumidores | Acción |
| --- | --- | --- | --- | --- |
| `secrets-diag` | 2026-05-07 | **200 sin autenticación** | ninguno | **P0**: tumba hoy, borrar en 48 h |
| `mcp` | 2026-07-23 | 405 (servidor MCP vivo) | solo documentación | P1: tumba → 7 días → borrar |
| `agenticworkflows` | 2026-07-23 | 401 | ninguno | P2 |
| `consume-credits` | 2026-07-23 | 401 | ninguno en el repo | P2; la RPC `consume_credits` se queda |
| `skills-ingest` | 2026-07-23 | 404 de la plataforma | — | nada; ya está |

`secrets-diag` es el caso que justifica este runbook: se borró del repositorio
en mayo y siguió publicando, a cualquiera que llamara, un inventario de **12
variables** con `present`, `len` y `fp` (primeros y últimos 3 caracteres):
Gemini, OpenAI, Anthropic, Grok, Firecrawl, `GITHUB_PAT`, Liveuamap, Cesium,
Lovable y `SUPABASE_URL`. Medido hoy: **200 sin sesión, 10 de las 12
configuradas**. No expone valores completos, pero confirma qué claves existen y
cuánto miden. Al retirarla, valorar rotar `GITHUB_PAT` y las claves de pago si
la política lo exige; el resto de nombres ya están documentados en
`docs/edge-functions.md` y no son secreto.

Nota sobre `consume-credits`: la función se va, la función SQL **no**.
`consume_credits(uuid, integer)` tiene `EXECUTE` revocado a `anon`/`authenticated`
y concedido solo a `service_role` en las migraciones de 2026-08-01; expulsarla
del esquema requiere su propia migración y no forma parte de esta retirada.

---

## Limitaciones conocidas

- **Sin token no hay descubrimiento**: las sondas solo responden por nombres ya
  conocidos. Una función creada a mano en el panel y nunca registrada es
  invisible para `functions:retire`; la lista de 1a es la única red.
- **Los logs son la prueba del tráfico**, y su retención depende del plan del
  proyecto. Si caducan antes de la ventana de 7 días, la decisión se apoya en
  consumidores conocidos, no en tráfico observado: anotarlo.
- **`404` ambiguo**: una función viva que responde 404 por su cuenta no se puede
  distinguir con una sonda. Se marca, no se borra.
- **La tumba no es gratis**: ocupa un slot de función y aparece en `edge:check`
  hasta que se borra. Es el precio de una retirada reversible.
- **Este entorno no tiene `supabase` CLI ni `SUPABASE_ACCESS_TOKEN`**: aquí solo
  se ha podido ejecutar el brazo de sondas. Las fases de despliegue y borrado
  requieren ejecutarse desde una máquina con el token del propietario.
