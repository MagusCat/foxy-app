<p align="center">
  <img src="docs/sources/foxy.png" alt="Foxy" width="720">
</p>

<h1 align="center">Foxy</h1>

<p align="center">
  Plataforma educativa con IA generativa y adaptativa.<br>
  Ajusta explicaciones, planes y evaluaciones al perfil de cada usuario y al material que sube.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.26-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go 1.26">
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.12">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native">
  <img src="https://img.shields.io/badge/PostgreSQL_+_pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL + pgvector">
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
</p>

<p align="center">
  <sub>Hackathon Nicaragua 2026 · categoría Educación</sub>
</p>
<p align="center">
  <sub>Proyecto no clasificado</sub>
</p>

---

## Arquitectura

Tres procesos independientes contra una misma base de datos en Supabase. Se
levantan por separado: el móvil no necesita el servicio de IA y el backend
funciona sin él (modo stub).

```text
mobile (Expo)  ──▶  backend Go :8080  ──▶  ai-service :8000
                          │                      │
                          └──────▶ Supabase ◀────┘
                             Postgres · Auth · Storage
```

| Componente | Tecnología | Rol |
|---|---|---|
| **Mobile** | React Native (Expo) | App multiplataforma para estudiantes y docentes (`mobile/`). |
| **Backend Core** | Go | API Gateway, autenticación JWT, orquestación y lógica de negocio (`backend/`). |
| **AI Service** | Python · FastAPI | Chat, generación de material, extracción de texto, embeddings y RAG (`ai-service/`). |
| **Datos** | PostgreSQL + pgvector | Datos relacionales y vectores en una sola base (Supabase). |

```text
foxy-service/
├── mobile/         App móvil (React Native)
├── backend/        Servidor core (Go)
├── ai-service/     Microservicio de IA (Python)
├── supabase/       Migraciones de la base de datos
└── docs/           Contratos, esquemas y especificaciones compartidas
```

## Documentación

| Documento | Contenido |
|---|---|
| [docs/](docs/README.md) | Índice: contratos, esquemas y guías, con respuestas rápidas. |
| [Backend](backend/README.md) | API Gateway, seguridad, viaje de una petición. |
| [AI Service](ai-service/README.md) | Chat, RAG, embeddings e integración con el modelo. |
| [Mobile](mobile/README.md) | Cliente móvil (aún no implementado). |
| [Arquitectura](docs/architecture.md) | Estructura interna del backend y modelo de seguridad. |
| [Configuración](docs/configuration.md) | Variables de entorno, cuáles deben coincidir y qué falla cuando no. |

## Módulos

| Módulo | Usuario | Funcionalidad |
|---|---|---|
| Planes de estudio | Estudiante | Rutas de aprendizaje estructuradas por temas y objetivos. |
| Material auto-didacta | Estudiante | Flashcards y cuestionarios a partir de apuntes o documentos. |
| Evaluación en tiempo real | Estudiante | Tests dinámicos con retroalimentación inmediata. |
| Planificación docente | Docente | Asistente para programas, contenidos y actividades. |
| Búsqueda de fuentes | Docente | Sugerencia de material bibliográfico complementario. |
| Motor adaptativo | Ambos | Ajuste de respuestas según perfil, nivel y archivos subidos. |

## Requisitos

| Herramienta | Versión | Para |
|---|---|---|
| Go | 1.26+ | `backend/` |
| Python | 3.12+ | `ai-service/` |
| Node | 20+ | `mobile/` |
| Proyecto Supabase | — | Postgres, Auth y Storage |

Una llave de proveedor de modelos es opcional: hay dos modos sin llave (ver
[Trabajar sin llave](#trabajar-sin-llave)).

## Puesta en marcha

### 1. Base de datos

El esquema vive en `docs/schemas/` y se aplica con las migraciones de
`supabase/migrations/`:

```bash
supabase link --project-ref <ref>
supabase db push
```

Falta un paso que no está en las migraciones: crear el bucket de Storage
(`attachments`, o el valor de `STORAGE_BUCKET`). Debe ser **privado** —las
descargas las hace el backend con su llave— y conviene fijar ahí el límite de
tamaño y los MIME permitidos, que es el único tope duro sobre lo que se sube.

### 2. AI Service

```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:create_app --factory --reload --port 8000
```

`LLM_PROVIDER` es `fake` (sin red ni llave) o `openai_compat` (endpoint real,
con `LLM_BASE_URL`, `LLM_MODEL` y `EMBEDDING_MODEL` explícitos). El detalle de
proveedores concretos (Gemini, DeepSeek, Ollama…) está en el
[README del ai-service](ai-service/README.md#6-el-modelo-es-una-pieza-no-el-centro).
Comprobar con `curl localhost:8000/ready`.

### 3. Backend

```bash
cd backend
cp .env.example .env
go run ./cmd/api
```

Obligatorias: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. Para
conectarlo con la IA:

```bash
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TOKEN=      # si se pone, debe ser idéntico al del ai-service
```

Comprobar con `curl localhost:8080/health`.

### 4. Mobile

```bash
cd mobile
npm install
npm start
```

Abre Expo: se escanea el QR con Expo Go o se pulsa `a` para un emulador Android.

## Trabajar sin llave

| Modo | Cómo | Qué se ejercita |
|---|---|---|
| Stub del backend | `AI_SERVICE_URL=stub` | Todo el backend, con respuestas de IA fijas. No hace falta Python. |
| Proveedor fake | `LLM_PROVIDER=fake` | El flujo completo real: ingesta, troceado, embeddings, búsqueda vectorial y streaming. Solo el texto del modelo es fijo. |

El modo `fake` vectoriza por hashing de palabras, así que la búsqueda encuentra
fragmentos que comparten términos con la pregunta. `/ready` lo advierte para que
un despliegue en este modo no parezca sano.

## Pruebas

```bash
cd ai-service && pytest        # sin red, sin llave, sin Postgres
cd backend    && go test ./...  # unitarias, sin DB
```

Las pruebas de integración de ambos módulos se saltan solas si no hay
`DATABASE_URL`. Para incluirlas, cargar el entorno antes:

```bash
set -a && . ./.env && set +a && go test ./...
```

## Problemas frecuentes

| Síntoma | Causa |
|---|---|
| `ECONNREFUSED` contra Postgres | `DATABASE_URL` apunta a la conexión directa (solo IPv6). Usar el Session Pooler (puerto 5432). |
| El proceso Python se queja de embeddings | El proveedor elegido no los sirve. Configurar `EMBEDDING_*` por separado. |
| El adjunto queda en `failed` | El ai-service no responde, o el bucket no existe. |
| `401` desde el ai-service | `AI_SERVICE_TOKEN` no coincide entre los dos procesos. |
| El chat responde siempre lo mismo | Backend en `AI_SERVICE_URL=stub`, o ai-service en `LLM_PROVIDER=fake`. |
| El proyecto continuara siendo desarrollado | No. |
