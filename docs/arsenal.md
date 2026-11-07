# Arsenal: los repos del dueño, con destino

`src/data/arsenal.json` no es una lista de enlaces: es el mapa de qué se hace
con cada repo. La pestaña **Sistema → Arsenal** lo pinta agrupado por destino y
el filtro real está en los datos, no en la interfaz.

## Las tres etiquetas

| Estado | Qué significa | Quién decide |
|---|---|---|
| `incorporado` | Ya vive en AiTor; se puede señalar el cambio | nadie, es un hecho |
| `candidato` | Pieza concreta que se puede traer sin claves nuevas ni runtime ajeno | requiere un PR |
| `referencia` | Se lee para aprender, no se copia | licencia, runtime o producto externo |

## Por qué la mayoría son `referencia`

De los **251** repos de la cuenta, **239 son forks**. Un fork no es código
propio: arrastra la licencia del original (`ghidra` es Apache-2.0, `immich` es
AGPL, `n8n` es *fair-code*, `ollama` es MIT con matices), su runtime (Python,
GPU, contenedores) o su modelo de despliegue. Copiar un trozo sin mirar eso es
cómo se mete una licencia incompatible en un proyecto GPL-3.0.

Los datos traen `license` por repo y `arsenalLicenses()` cuenta también los
`null` como «sin licencia», que es el caso que **no** se puede fusionar.

## Qué se incorporó ya

- **`headroom`** → presupuesto de resultados de herramientas en `api/mcp.ts`
  (`compressToolResult`, `budgetToolResponse`): conserva principio y final y
  rescata las líneas de error del trozo descartado. PR #42.
- **`ACE.AGameFlow`** → el circuito de juego de ACE aparece en GameFi
  (`GAMEFI_TRACKS`) y es el referente de la minería de energía.

## Candidatos con pieza concreta

| Repo | Destino | Pieza que se trae | Qué hace falta |
|---|---|---|---|
| ~~`aemet-client`~~ | Atmósfera | **Incorporado**: `weather.aemet` (previsión municipal y observación con el sobre de dos pasos) | sólo `AEMET_API_KEY` |
| `xerj` / `codebase-memory-mcp` | Memoria | Índice de símbolos del repo para el agente, en vez de releer ficheros | nada |
| `claude-mem` | Memoria | Resumen de turnos anteriores con presupuesto de tamaño | nada |
| `ccxt` | Mercados | Nombres de exchange y símbolos normalizados para el proxy | nada (sólo el catálogo) |
| `polyweather` | Mercados | Cruce clima × mercados de predicción | lectura, sin ejecución |
| `prediction-market-backtesting` | Mercados | Formato de histórico para contrastar una señal | datos |
| `crawl4ai` / `crawlee` / `scrapling` | Sistema | Extracción robusta para OSINT | runtime Python o Node |
| `ffmpeg-skill` | Sistema | Contrato de 42 herramientas ffmpeg para el agente de medios | nada |
| `whisper` / `unlimited-ocr` | Sistema | Transcripción y OCR como herramientas MCP | clave o modelo local |
| `worldmonitor` | Globo | Capas de monitorización global (ya hay feed OSINT propio) | revisar licencia AGPL |
| `claude-code-hooks` / `loop-engineering` | Agentes | Ganchos y bucles de trabajo para el bucle de herramientas | nada |

## Qué no se trae, y por qué

- **Mercados con ejecución** (`Lean`, `nautilus_trader`, `freqtrade`,
  `hummingbot`, `FinRL`, `TradingAgents`, bots de Polymarket): necesitan claves
  de exchange, custodia y un runtime que este despliegue no tiene. AiTor lee
  mercados; no opera.
- **Agentes de escritorio o SWE completos** (`openhands`, `open-swe`, `orca`,
  `agent-desktop`): son productos con su propio servidor. Se leen sus
  decisiones (presupuesto de contexto, hooks, permisos) y se aplican aquí.
- **`ghidra`, `hackingtool`, `reverse-engineer-Wi-Fi-router`**: herramientas de
  escritorio para análisis de binarios. Fuera del alcance de una web.

## Refrescar

```bash
npm run arsenal:sync      # metadata real de GitHub → src/data/arsenal.json
```

Las etiquetas (`destination`, `status`) son decisiones humanas y el script no
las toca: sólo actualiza descripción, estrellas, licencia y último push, para
que el panel no envejezca mintiendo.
