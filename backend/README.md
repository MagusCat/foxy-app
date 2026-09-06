# Backend Core

API Gateway de Foxy en Go. Expone la API REST que consume la app móvil, valida
el JWT que emite Supabase Auth, orquesta al `ai-service` y persiste en Postgres.

> [!NOTE]
> No gestiona registro, login ni contraseñas: de eso se encarga Supabase. La
> estructura por carpeta está en [../docs/architecture.md](../docs/architecture.md);
> el esquema de datos, en [../docs/schemas/schema_v3.sql](../docs/schemas/schema_v3.sql).

## Responsabilidades

| Área | Qué hace |
|---|---|
| API REST | Sirve `/api/v1` y un `/health` sin autenticación. |
| Autorización | Valida el JWT de Supabase (ES256, contra el JWKS del proyecto). El `user_id` sale del claim `sub`. |
| Persistencia | `pgx` sin ORM. La conexión hace bypass de RLS, así que toda la autorización vive en el código y cada consulta filtra por usuario. |
| Orquestación de IA | Chat por streaming, generación de material y extracción de texto se delegan al `ai-service` (o modo stub). |
| Storage | Firma URLs de subida de Supabase; el archivo binario no pasa por el backend. |

## Requisitos

| Requisito | Valor |
|---|---|
| Go | 1.26+ |
| Módulo | `github.com/foxy-app/backend` |
| Capa HTTP | Librería estándar (`net/http`, `ServeMux` con enrutado por método, Go 1.22+). Sin framework. |
| Base de datos | Proyecto Supabase (Postgres, Auth, Storage) |

Dependencias directas:

| Dependencia | Uso |
|---|---|
| `jackc/pgx/v5` | Cliente y pool de Postgres. |
| `golang-jwt/jwt/v5` | Verificación del JWT. |
| `MicahParks/keyfunc/v3` | Descarga, caché y rotación del JWKS. |
| `google/uuid` | Identificadores. |
| `golang.org/x/time` | Limitador de tasa por usuario. |
| `golang.org/x/sync` | `errgroup` para el trabajo concurrente del chat. |

## Ejecución

```bash
cp .env.example .env
set -a && . ./.env && set +a
go run ./cmd/api            # arranca en :8080
```

> [!IMPORTANT]
> El binario no lee `.env`: solo `os.Getenv`. Hay que exportar las variables
> antes (la línea `set -a` de arriba). Si falta una obligatoria, el proceso no
> arranca: falla al boot, no a media petición.

Comprobar: `curl localhost:8080/health`.

## Variables

Obligatorias:

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Conexión a Postgres. Session Pooler (IPv4); la directa es solo IPv6. |
| `SUPABASE_URL` | De él se derivan el JWKS y el issuer. |
| `SUPABASE_SECRET_KEY` | Llave secreta de Supabase (antes `service_role`; ese nombre se sigue aceptando). Nunca sale del backend. |
| `AI_SERVICE_TOKEN` | Firma un token por petición al `ai-service`; idéntico allá. Omitible con `AI_SERVICE_URL=stub` o `ALLOW_INSECURE=true`. |

Con valor por defecto:

| Grupo | Variables |
|---|---|
| Servicio | `HOST`, `PORT`, `LOG_LEVEL`, `ALLOWED_ORIGINS`, `REQUEST_TIMEOUT`, `SHUTDOWN_TIMEOUT` |
| IA | `AI_SERVICE_URL` (`stub` responde texto fijo sin red), `STORAGE_BUCKET` |
| Límites | `RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_BURST`, `MAX_CONCURRENT_STREAMS` |
| Postgres | `DB_MAX_CONNS` |
| Auth (override) | `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER` |

> [!NOTE]
> Los prompts no se configuran aquí: viven en el `ai-service`
> (`app/prompts.toml`). El backend manda el perfil del usuario en crudo y aquel
> redacta el system prompt.

El detalle de cada variable y cuáles comparte con el `ai-service` está en
[../docs/configuration.md](../docs/configuration.md).

## Seguridad

> [!IMPORTANT]
> La conexión a Postgres hace bypass de RLS: la base no protege los datos, lo
> hace el código. Todo repository recibe el `userID` y lo incluye en el `WHERE`.
> Un `GET` sobre un recurso ajeno devuelve 404, no 403, para no revelar que
> existe.

La red que sostiene ese contrato es `TestForeignUserGets404`, una prueba de
integración por repository que verifica contra una base real que un usuario no
ve ni borra recursos de otro. Si un query olvidara el filtro, esa prueba falla.

> [!NOTE]
> En la base, la RLS está habilitada sin ninguna policy, a propósito: cierra el
> acceso directo por PostgREST. Añadir una policy permisiva abriría un agujero en
> lugar de cerrarlo.

## Viaje de una petición

`POST /api/v1/zones` con `Authorization: Bearer <jwt>`:

```text
recover      convierte cualquier panic en un 500 limpio
request-id   asigna un id que va en cada log y en la respuesta
logger       registra método, ruta, status y duración
cors         cabeceras CORS
auth         valida el JWT y mete el user_id en el context (401 si falla)
timeout      30s por defecto (se omite en streaming)
rate-limit   solo en endpoints que cuestan IA
handler      Decode corta el body a 1 MB, rechaza campos desconocidos, corre Validate()
service      aplica la regla de negocio
repository   SQL parametrizado filtrado por userID
respuesta    { data, meta } o { error: { code, message }, meta }
```

> [!NOTE]
> El handler nunca escribe el status a mano: un error de dominio se mapea solo
> (NotFound a 404, VALIDATION_ERROR a 400) y uno desconocido cae a 500, que se
> registra completo pero no se expone al cliente.

El chat es el único endpoint por SSE y se aparta del flujo: no lleva timeout
global, mantiene un heartbeat cada 15 s para que los proxies no corten mientras
la IA produce el primer token, y persiste la respuesta con `context.WithoutCancel`
para no perderla si el cliente se desconecta. El contexto de cada respuesta se
arma con SQL plano en `chat/repository.go` (`GatherContext`): perfil, objetivos
de la zona y texto de los últimos documentos, con un presupuesto de tokens que
trunca el excedente.

## Estructura

```text
cmd/api/main.go        arranque: solo llama a app.Run()
internal/
  app/                 composition root: config, pool, router y shutdown
  platform/            infraestructura transversal, sin lógica de negocio
  feature/             un paquete por dominio: profile zones chat attachments
                       materials events topics
```

Cada dominio de `feature/` repite la misma forma, y cada capa solo conoce a la
de abajo:

```text
model.go        tipos de dominio y constantes
requests.go     un struct por endpoint de entrada, con su Validate()
repository.go   SQL con pgx; recibe el userID y lo mete en el WHERE
service.go      reglas de negocio; no conoce HTTP ni SQL crudo
handler.go      declara las rutas y adapta HTTP a service
```

> [!NOTE]
> `feature/` depende de `platform/`, nunca al revés, y un dominio no importa a
> otro. Cuando uno necesita algo de otro, `app/` le inyecta una función. Hoy el
> único caso es el chat, que recibe de `profile` la función que registra la
> racha de estudio.

## Pruebas

```bash
go test ./...                                   # unitarias, rápidas, sin DB
set -a && . ./.env && set +a && go test ./...   # + integración contra la DB real
```

Unitarias: el `Validate()` de cada request, el cursor keyset y el mapeo error a
status. Integración: el `TestForeignUserGets404` de cada repository, más una
prueba en `materials` que detecta cualquier deriva entre el código y el `CHECK`
de la base. Se saltan si no hay `DATABASE_URL`.
