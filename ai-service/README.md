# AI Service

Servicio en Python (FastAPI) que resuelve todo lo que necesita un modelo de
lenguaje en Foxy: el chat, la generación de material de estudio y el contexto
documental (extracción de texto, embeddings y búsqueda por similitud).

> [!NOTE]
> Es un servicio interno: lo consume solo el backend, nunca la app móvil. El
> contrato del cliente vive en `backend/internal/platform/aiclient/`.

## Endpoints

| Endpoint | Responsabilidad |
|---|---|
| `POST /v1/chat` | Respuesta del asistente, token a token por SSE. |
| `POST /v1/generate` | Material en JSON: resumen, apuntes, tarjetas, examen o tarea. |
| `POST /v1/extract` | Texto de un archivo de Storage, más su indexado vectorial. |
| `GET /health` | Liveness. No toca la red. |
| `GET /ready` | Readiness: prueba Postgres e informa el proveedor activo. |

La especificación OpenAPI está en `docs/api-specs/ai-service.json`. Se regenera con:

```bash
python -c "import json;from app.main import create_app;print(json.dumps(create_app().openapi(),indent=2,ensure_ascii=False))" > ../docs/api-specs/ai-service.json
```

## Requisitos

| Requisito | Valor |
|---|---|
| Python | 3.12+ |
| Base de datos | Proyecto Supabase (Postgres + Storage) |
| Proveedor de modelos | Opcional — `LLM_PROVIDER=fake` corre sin red ni llave |

## Ejecución

Desde `ai-service/`:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:create_app --factory --reload --port 8000
```

Comprobar: `curl localhost:8000/ready`.

## Variables

Obligatorias:

| Variable | Qué es | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Conexión a Postgres. Session Pooler, puerto 5432. | `postgresql://postgres.<ref>:<pass>@aws-0-us-east-1.pooler.supabase.com:5432/postgres` |
| `SUPABASE_URL` | Base de Storage de donde se descargan los adjuntos. | `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Llave secreta de Supabase. | `sb_secret_...` |
| `AI_SERVICE_TOKEN` | Token compartido con el backend. Omitible con `ALLOW_INSECURE=true`. | `un-secreto-largo-compartido` |
| `LLM_PROVIDER` | `fake` o `openai_compat`. | `openai_compat` |
| `LLM_BASE_URL`, `LLM_MODEL`, `EMBEDDING_MODEL` | Obligatorias con `openai_compat`. | `https://api.openai.com/v1`, `gpt-4.1-mini`, `text-embedding-3-small` |

Opcionales:

| Grupo | Variables |
|---|---|
| Servicio | `LOG_LEVEL=info`, `ALLOW_INSECURE=false`, `PROMPTS_FILE=` (el del paquete) |
| Modelo | `LLM_TEMPERATURE=0.4`, `LLM_TIMEOUT=90`, `LLM_MAX_RETRIES=2`, `LLM_API_KEY=` |
| Embeddings | `EMBEDDING_DIM=1536`, `EMBEDDING_BATCH=96`, `EMBEDDING_MAX_RETRIES=5`, `EMBEDDING_BASE_URL=`, `EMBEDDING_API_KEY=` |
| Storage | `STORAGE_BUCKET=attachments`, `MAX_DOWNLOAD_BYTES=31457280`, `MAX_DECOMPRESSED_BYTES=104857600`, `MAX_PDF_PAGES=500`, `MAX_REQUEST_BYTES=2097152` |
| Postgres | `DB_MIN_CONNS=1`, `DB_MAX_CONNS=5`, `DB_COMMAND_TIMEOUT=30`, `DB_ACQUIRE_TIMEOUT=10` |
| Contexto | `CHUNK_SIZE=1200`, `CHUNK_OVERLAP=150`, `RETRIEVAL_TOP_K=8`, `RETRIEVAL_CHAR_BUDGET=8000`, `EXTRACT_MAX_CHARS=100000` |

> [!WARNING]
> `EMBEDDING_DIM` está atada a la columna `vector(1536)`. Cambiarla obliga a
> recrear la columna con su índice y reprocesar todos los adjuntos.

El detalle de cada variable y cuáles comparte con el backend está en
[../docs/configuration.md](../docs/configuration.md).

## Proveedor del modelo

`app/llm/base.py` declara lo único que se necesita de un proveedor: `stream`,
`complete`, `embed` y `aclose`. La implementación incluida habla la API de
OpenAI (`openai_compat`), el dialecto que aceptan casi todos.

```bash
# Gemini vía su capa OpenAI-compatible
LLM_PROVIDER=openai_compat
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL=gemini-3.5-flash
EMBEDDING_MODEL=gemini-embedding-001
LLM_API_KEY=...
```

> [!NOTE]
> Un proveedor que solo sirve chat (p. ej. DeepSeek) necesita los embeddings de
> otro endpoint: `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`. El
> proceso no arranca si faltan.

> [!TIP]
> `LLM_PROVIDER=fake` corre sin red ni llave: texto fijo y vectorización por
> hashing de palabras. (Solo para testing).

## Contexto documental (RAG)

**Ingesta** (`/v1/extract`): descarga de Storage → extracción de texto →
troceado (~1200 caracteres, 150 de solapamiento) → embeddings en lote →
`document_chunks`. Es idempotente: reintentar no duplica.

**Recuperación** (en cada chat y cada generación): se vectoriza la consulta —los
últimos turnos del usuario—, se buscan los fragmentos más parecidos entre los
adjuntos indicados y se anexan al último turno.

> [!NOTE]
> El bloque recuperado se pega al último turno del usuario, no al `system`: los
> proveedores cachean por prefijo, así que lo estable va delante y lo variable
> al final.

> [!IMPORTANT]
> El servicio no decide permisos: busca solo dentro de los `attachment_id` que
> recibe; la autorización es del backend. Los fragmentos entran rotulados como
> material de referencia, no como instrucciones.

Formatos con extractor: pdf, docx, pptx, txt y md. Las imágenes pasan por la
visión del modelo; un formato sin extractor responde 400.
## Límites

Ninguna validación del backend protege a este servicio: el MIME y el tamaño se
comprueban sobre lo que **declara** el cliente al pedir la URL firmada. Los topes
sobre los bytes reales viven aquí.

| Límite | Qué evita |
|---|---|
| `MAX_DOWNLOAD_BYTES` | Que un objeto entero entre en RAM. |
| `MAX_DECOMPRESSED_BYTES` | Bomba de descompresión (docx y pptx son ZIP). |
| `MAX_PDF_PAGES` + `EXTRACT_MAX_CHARS` | Parsear un PDF enorme para descartar casi todo. |
| `MAX_REQUEST_BYTES` | Almacenar un POST gigante antes de validarlo. |
| `DB_COMMAND_TIMEOUT`, `DB_ACQUIRE_TIMEOUT` | Que una consulta lenta agote el pool. |

## Estructura

```text
app/
  main.py       create_app(): ciclo de vida, middleware, manejo de errores
  router.py     construye los servicios y monta las rutas
  schemas.py    contrato compartido (ChatContext, Message, Retrieval)
  prompts.py    arma el system prompt del chat
  prompts.toml  todos los prompts: persona, citado, formato del material
  llm/          proveedor del modelo: base.py, openai_compat.py, fake.py
  platform/     config, logging, errores, db, storage, security, sse
  feature/      chat/  materials/  documents/
```
## Pruebas

```bash
pytest
ruff check .
```

Las de integración se saltan si no hay `DATABASE_URL`. Para incluirlas:

```bash
set -a && . ./.env && set +a && pytest
```

## Despliegue

`Dockerfile` de dos etapas; `CMD` sobre uvicorn en forma exec, con el bind desde
`UVICORN_HOST` y `UVICORN_PORT` (que uvicorn lee directamente).