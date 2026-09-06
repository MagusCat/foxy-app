# Configuración por entorno

| Variable | Qué pasa si no coinciden |
|---|---|
| `AI_SERVICE_TOKEN` | El backend firma con una clave y el ai-service verifica con otra: **todo** responde 401. No es una degradación, es un corte total |
| `SUPABASE_SECRET_KEY` | El que tenga la llave mala falla al tocar Storage; el otro sigue como si nada |
| `SUPABASE_URL` | Uno sube los adjuntos a un proyecto y el otro los busca en otro: extracciones en `failed` sin más pista |
| `STORAGE_BUCKET` | Igual que el anterior, pero dentro del mismo proyecto |

> [!IMPORTANT]
> `AI_SERVICE_TOKEN` **no es un bearer que se mande tal cual**. Es la clave HMAC
> con la que Go firma un JWT por petición (HS256, 5 min de vida, con el usuario y
> el alcance del endpoint dentro). Cámbiala en un solo lado y la comunicación
> entre servicios se corta entera. Los detalles están en
> [architecture.md](architecture.md#cómo-se-autentican-los-dos-servicios-entre-sí).

## Backend (Go)

### Obligatorias

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Postgres. Usa el **Session Pooler** de Supabase (puerto 5432, IPv4); la conexión directa es solo IPv6 y suele fallar con `ECONNREFUSED` |
| `SUPABASE_URL` | De aquí se derivan el JWKS y el issuer con que se validan los JWT del móvil |
| `SUPABASE_SECRET_KEY` | La *secret key* del panel (antes `service_role`). Nunca sale del backend ni llega al móvil. Se sigue aceptando el nombre viejo `SUPABASE_SERVICE_ROLE_KEY` |
| `AI_SERVICE_TOKEN` | Clave de firma compartida. Exigida salvo con `AI_SERVICE_URL=stub` o `ALLOW_INSECURE=true` |

### Con valor por defecto

| Variable | Def. | Para qué |
|---|---|---|
| `HOST` | vacío | Interfaz de escucha; vacío = todas. `127.0.0.1` deja el proceso alcanzable solo desde su máquina |
| `PORT` | `8080` | |
| `LOG_LEVEL` | `info` | |
| `AI_SERVICE_URL` | `http://localhost:8000` | `stub` responde texto fijo sin red: permite trabajar sin Python levantado |
| `ALLOW_INSECURE` | `false` | Solo desarrollo: arranca sin la clave compartida |
| `STORAGE_BUCKET` | `attachments` | |
| `ALLOWED_ORIGINS` | `*` | CSV. **En producción fíjalo** a los orígenes reales |
| `SUPABASE_JWKS_URL` | derivada | Solo para sobreescribir la que sale de `SUPABASE_URL` |
| `SUPABASE_JWT_ISSUER` | derivada | Igual |
| `RATE_LIMIT_PER_MINUTE` | `30` | Por usuario, en memoria, sobre los endpoints que cuestan IA |
| `RATE_LIMIT_BURST` | `10` | |
| `MAX_CONCURRENT_STREAMS` | `256` | Techo de SSE simultáneos. Esas rutas no llevan `WriteTimeout` a propósito, así que es lo único que las acota |
| `REQUEST_TIMEOUT` | `30s` | No aplica al streaming SSE |
| `SHUTDOWN_TIMEOUT` | `10s` | |
| `DB_MAX_CONNS` | `10` | |

## ai-service (Python)

### Obligatorias

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Solo toca una tabla: `document_chunks`. Mismo Session Pooler |
| `SUPABASE_URL` | Descargar los adjuntos de Storage |
| `SUPABASE_SECRET_KEY` | La misma llave secreta del backend |
| `AI_SERVICE_TOKEN` | La misma clave de firma. Exigida salvo `ALLOW_INSECURE=true` |
| `LLM_PROVIDER` | `fake` (sin red ni llave) o `openai_compat` (endpoint real). Sin default: hay que declararlo |
| `LLM_BASE_URL` | Obligatoria con `openai_compat`. Endpoint OpenAI-compatible (gemini, deepseek, openai, groq, openrouter, vLLM, ollama) |
| `LLM_MODEL` | Obligatoria con `openai_compat`. Nombre del modelo de chat |
| `EMBEDDING_MODEL` | Obligatoria con `openai_compat`. Modelo de embeddings |


### Modelo

| Variable | Def. | Para qué |
|---|---|---|
| `LLM_API_KEY` | vacío | Opcional: los endpoints locales (ollama, vLLM) no piden llave. Su validez no se sabe hasta la primera petición |
| `LLM_TEMPERATURE` | `0.4` | |
| `LLM_TIMEOUT` | `90` | Segundos |
| `LLM_MAX_RETRIES` | `2` | Bajo a propósito: en el chat un reintento se paga en latencia con el usuario esperando |

### Embeddings

| Variable | Def. | Para qué |
|---|---|---|
| `EMBEDDING_BASE_URL` | la del chat | Solo si los embeddings van a otro endpoint (p. ej. deepseek + gemini) |
| `EMBEDDING_API_KEY` | la del chat | |
| `EMBEDDING_MODEL` | — | Obligatoria con `openai_compat` (ver arriba) |
| `EMBEDDING_DIM` | `1536` | **Atada a `document_chunks.embedding vector(1536)`.** Cambiarla obliga a recrear la columna con su índice HNSW y reprocesar todos los adjuntos |
| `EMBEDDING_BATCH` | `96` | |
| `EMBEDDING_MAX_RETRIES` | `5` | Más alto que el del chat a propósito: nadie espera delante, y rendirse deja el adjunto en `failed` sin nada que lo reprocese |

### Servicio, Postgres y techos

| Variable | Def. | Para qué |
|---|---|---|
| `UVICORN_HOST` | `0.0.0.0` | Interfaz de escucha. La lee **uvicorn**, no la aplicación |
| `UVICORN_PORT` | `8000` | Igual |
| `LOG_LEVEL` | `info` | Logger de la aplicación. El de uvicorn es aparte: `UVICORN_LOG_LEVEL` |
| `ALLOW_INSECURE` | `false` | Solo desarrollo |
| `STORAGE_BUCKET` | `attachments` | |
| `PROMPTS_FILE` | el del paquete | Apuntar a otra copia de `app/prompts.toml` prueba variantes sin reconstruir la imagen |
| `DB_MIN_CONNS` / `DB_MAX_CONNS` | `1` / `5` | |
| `DB_COMMAND_TIMEOUT` | `30` | |
| `DB_ACQUIRE_TIMEOUT` | `10` | |
| `MAX_DOWNLOAD_BYTES` | 30 MB | Por objeto descargado de Storage |
| `MAX_DECOMPRESSED_BYTES` | 100 MB | `docx` y `pptx` son ZIP: 200 KB pueden expandir a 200 MB |
| `MAX_PDF_PAGES` | `500` | |
| `MAX_REQUEST_BYTES` | 2 MB | El backend corta a 1 MB por su lado |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `1200` / `150` | |
| `RETRIEVAL_TOP_K` | `8` | |
| `RETRIEVAL_CHAR_BUDGET` | `8000` | |
| `EXTRACT_MAX_CHARS` | `100000` | |

## Qué se valida al arrancar

Los dos servicios comprueban su configuración antes de escuchar en el puerto y
**informan de todos los problemas a la vez**, no de uno por reinicio:

- Las obligatorias tienen que estar y **no estar vacías**: `SUPABASE_SECRET_KEY=`
  sin nada detrás cuenta como ausente.
- Un valor presente pero mal escrito **aborta el arranque** en vez de caer al
  valor por defecto en silencio. Eso incluye `ALLOW_INSECURE=yes` (no es un
  booleano), `REQUEST_TIMEOUT=30` (sin unidad), `RATE_LIMIT_PER_MINUTE=abc`,
  `DB_MAX_CONNS=0` y `LOG_LEVEL=verboso`. El caso peligroso es el primero: quien
  lo escribió cree haber abierto —o cerrado— el modo desarrollo.
- `DATABASE_URL`, `SUPABASE_URL` y `AI_SERVICE_URL` se comprueban **de esquema**.
  Que el host conteste es cosa de la primera petición; lo que se caza aquí es el
  error de copiar y pegar.
- Lo que cruza dos variables: `CHUNK_OVERLAP` < `CHUNK_SIZE`, `DB_MIN_CONNS` ≤
  `DB_MAX_CONNS`, `MAX_DOWNLOAD_BYTES` ≤ `MAX_DECOMPRESSED_BYTES`,
  `RATE_LIMIT_BURST` ≤ `RATE_LIMIT_PER_MINUTE`.

## Perfiles habituales

**Desarrollo sin nada más que Postgres** — ni llave de modelo ni Python levantado:

```bash
# backend/.env
AI_SERVICE_URL=stub
ALLOW_INSECURE=true
```

**Desarrollo con el ai-service de verdad, sin llave de modelo:**

```bash
# ai-service/.env
LLM_PROVIDER=fake
ALLOW_INSECURE=true
```

`/ready` avisa cuando las respuestas son fijas, para que nadie confunda el stub con
el servicio real.

**Producción** — lo mínimo que hay que revisar antes de desplegar:

- `ALLOW_INSECURE` sin poner (o `false`) en los dos.
- `AI_SERVICE_TOKEN` con un valor aleatorio y **el mismo** en ambos: `openssl rand -hex 32`.
- `ALLOWED_ORIGINS` fijado a los orígenes reales, nunca `*`.
- `AI_SERVICE_URL` apuntando al ai-service por red interna: tiene la service key y
  la base de datos, así que su puerto no debería ser alcanzable desde fuera.

Rotar `AI_SERVICE_TOKEN` exige reiniciar los dos a la vez: no hay soporte para dos
claves simultáneas, así que un despliegue escalonado rechaza peticiones durante la
ventana.

## Cuando no arranca

| Mensaje | Qué pasa |
|---|---|
| `invalid configuration: ...` | El informe lista `X required` / `X invalid`, una por línea. Si el `.env` existe, quizá no lo exportaste (ver arriba) |
| `X required` | Falta o está puesta pero vacía |
| `X invalid` | Valor mal escrito (número, booleano, esquema de URL, nivel de log). Aborta en vez de caer al default en silencio |
| `AI_SERVICE_TOKEN required` | ai-service sin clave compartida. Para local, `ALLOW_INSECURE=true` |
| `LLM_PROVIDER invalid` | Solo `fake` u `openai_compat` |
| `LLM_BASE_URL required` / `LLM_MODEL required` / `EMBEDDING_MODEL required` | Con `openai_compat` hay que declarar endpoint y modelos |
| `ECONNREFUSED` contra Postgres | Estás usando la conexión directa (IPv6). Cambia al Session Pooler |
| Todo responde 401 entre servicios | `AI_SERVICE_TOKEN` distinto en cada lado |