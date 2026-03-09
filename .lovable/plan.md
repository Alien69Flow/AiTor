
## Visión General

El usuario quiere que AI Tor pueda **escribir y editar archivos directamente en sus repositorios de GitHub**, igual que hace Lovable. Esto requiere:

1. **Expandir `github-proxy`** con acciones de escritura: `create_or_update_file`, `create_branch`, `get_file_sha` (necesario para editar archivos existentes)
2. **Nuevo prefijo en el chat**: `"Edita el repositorio de GitHub: "` → AI Tor genera un plan de cambios y los ejecuta
3. **Flujo en `useChat.ts`**: detectar intent de edición, buscar los archivos relevantes del repo, enviar al AI con instrucciones para generar los cambios exactos en formato estructurado, luego aplicarlos automáticamente vía la edge function
4. **Parseador de cambios**: el AI responde con un bloque especial `<github_changes>` que contiene los archivos a crear/editar, y el frontend lo intercepta y aplica

---

## Arquitectura del Flujo

```text
Usuario: "Edita el repositorio de GitHub: owner/repo — añade un README mejor"
         ↓
1. useChat detecta prefijo → llama performGitHubEdit(repoInput, instruction)
2. Fetches: repo_info + tree + archivos relevantes (package.json, README, etc.)
3. Construye prompt especial → AI genera respuesta con bloque <github_changes>
4. parseGitHubChanges() extrae archivos del bloque
5. Por cada archivo: github-proxy crea/actualiza en el repo
6. AI Tor confirma con lista de cambios aplicados
```

---

## Cambios Técnicos

### `supabase/functions/github-proxy/index.ts`
Añadir 3 nuevas acciones:

- **`get_file`** → GET contents (para leer SHA + contenido actual de un archivo)
- **`create_or_update_file`** → PUT `/repos/{owner}/{repo}/contents/{path}` con `{ message, content (base64), sha? }`
- **`create_branch`** → POST `/repos/{owner}/{repo}/git/refs` (opcional, para escribir en rama separada)

### `src/hooks/useChat.ts`
- Nuevo prefijo: `GITHUB_EDIT_PREFIX = "Edita el repositorio de GitHub: "`
- Nueva función `performGitHubEdit(repoInput, instruction)`:
  1. Parsear `owner/repo` y la instrucción (separados por `—` o `\n`)
  2. Fetch tree + archivos clave (≤10 archivos más relevantes con contenido)
  3. Construir prompt con contexto + instrucción
  4. Enviar al AI con instrucción de responder en formato:
     ```
     <github_changes>
     <file path="src/App.tsx">
     ...contenido completo...
     </file>
     </github_changes>
     ```
  5. Una vez el AI responde, llamar `applyGitHubChanges()` → aplica cada archivo via `github-proxy`
- Nueva función `applyGitHubChanges(owner, repo, files[])`:
  1. Para cada archivo: `githubFetch("get_file", ...)` para obtener SHA si existe
  2. `githubFetch("create_or_update_file", ...)` con contenido en base64

### `src/components/chat/ChatInput.tsx`
- Añadir nuevo tool `"Editar GitHub Repo"` con prompt `"Edita el repositorio de GitHub: "` y icono `GitBranch`
- Añadir shortcut en la barra rápida junto al botón Git existente

### `src/components/chat/ThinkingIndicator.tsx`
- Añadir estado `isEditingRepo` con texto `"Aplicando cambios al repositorio..."` y un icono `GitBranch` animado diferente (quizás `Loader2`)

### `src/hooks/useChat.ts` (retorno)
- Añadir `isEditingRepo` al estado exportado

### `src/components/chat/ChatContainer.tsx`
- Pasar `isEditingRepo` a `ThinkingIndicator`

---

## Formato de Respuesta del AI

El system prompt del chat NO se toca. En cambio, el prompt ensamblado en `useChat.ts` incluirá instrucciones explícitas:

```
Responde con los cambios en formato XML:
<github_changes>
<file path="ruta/al/archivo.ext">
CONTENIDO COMPLETO DEL ARCHIVO
</file>
</github_changes>

Luego explica qué cambiaste y por qué.
```

El parser extrae los bloques `<file>` antes de renderizar la respuesta al usuario, los aplica, y el resto de texto (explicación) se muestra normalmente.

---

## Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/github-proxy/index.ts` | + acciones `get_file`, `create_or_update_file` |
| `src/hooks/useChat.ts` | + `GITHUB_EDIT_PREFIX`, `performGitHubEdit`, `applyGitHubChanges`, state `isEditingRepo` |
| `src/components/chat/ChatInput.tsx` | + tool "Editar GitHub Repo" |
| `src/components/chat/ThinkingIndicator.tsx` | + estado `isEditingRepo` |
| `src/components/chat/ChatContainer.tsx` | + pasar `isEditingRepo` |
