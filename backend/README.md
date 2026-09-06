# Backend Core (Go)

API Gateway de Foxy. Expone la API HTTP/REST que consume la app móvil, valida el
JWT que emite Supabase Auth, orquesta al `ai-service` (Python) y persiste en
Postgres (Supabase). No gestiona registro, login ni contraseñas: de eso se
encarga Supabase.

Esta guía describe cómo está construido el servicio, qué se necesita de Go para
correrlo y cómo viaja una petición de principio a fin. Para el detalle de cada
carpeta, consúltese [../docs/architecture.md](../docs/architecture.md).

Documentos relacionados:

- Arquitectura por carpeta: [../docs/architecture.md](../docs/architecture.md)
- Consumo desde React Native / Expo: [../docs/mobile-integration.md](../docs/mobile-integration.md)
- Esquema de datos (fuente de verdad): [../docs/schemas/schema_v2.sql](../docs/schemas/schema_v2.sql)

## Qué hace

El servicio cumple cinco funciones:

1. Sirve la API REST bajo `/api/v1`, más un `/health` sin autenticación.
2. Autoriza cada petición validando el JWT de Supabase (ES256, verificado contra
   el JWKS del proyecto). El `user_id` se toma del claim `sub`.
3. Persiste con `pgx` sin ORM. La conexión usa `service_role`, que hace bypass de
   RLS; por eso toda la autorización vive en el código y cada consulta filtra por
   el usuario.
4. Orquesta a la IA: chat por streaming, generación de material y extracción de
   texto se delegan al `ai-service`. Si no está disponible, se puede correr en
   modo stub.
5. Firma URLs de subida de Supabase Storage. El archivo binario no pasa por el
   backend: el móvil sube directo a Storage.

## Requisitos y stack

- Go 1.26 o superior. Módulo `github.com/foxy-app/backend`.
- La capa HTTP se construye solo con la librería estándar: `net/http` y el
  `http.ServeMux` con enrutado por método y patrón introducido en Go 1.22
  (por ejemplo, `GET /api/v1/zones/{id}`). No hay framework web; la cadena de
  middleware está escrita a mano.
- Dependencias directas:

  | Dependencia | Uso |
  |---|---|
  | `jackc/pgx/v5` | Cliente y pool de Postgres. |
  | `golang-jwt/jwt/v5` | Verificación del JWT. |
  | `MicahParks/keyfunc/v3` | Descarga, cache y rotación del JWKS. |
  | `google/uuid` | Identificadores. |
  | `golang.org/x/time` | Limitador de tasa por usuario. |

## Cómo correrlo

```bash
cp .env.example .env    # completar los valores (ver notas)
go run ./cmd/api        # arranca en :8080
```

Variables requeridas para arrancar. Si falta alguna, el proceso no inicia (falla
al boot, no a media petición):

- `DATABASE_URL`: usar el Session Pooler de Supabase (IPv4). La conexión directa
  es solo IPv6 y suele fallar con `ECONNREFUSED`.
- `SUPABASE_URL`: de él se derivan el JWKS y el issuer.
- `SUPABASE_SERVICE_ROLE_KEY`: secreta; nunca sale del backend ni llega al móvil.

Variables opcionales con valor por defecto: `PORT` (8080), `LOG_LEVEL` (info),
`AI_SERVICE_URL` (`stub` responde texto fijo sin red, para desarrollar sin el
servicio de Python), `STORAGE_BUCKET`, `ALLOWED_ORIGINS`, `RATE_LIMIT_PER_MINUTE`,
`RATE_LIMIT_BURST`, `REQUEST_TIMEOUT`, `SHUTDOWN_TIMEOUT`, `DB_MAX_CONNS` y
`FOXY_SYSTEM_PROMPT`. El detalle está en `.env.example`.

## Cómo está organizado

El punto de entrada es mínimo y todo el cableado vive en `internal/app`:

```text
cmd/api/main.go        arranque: solo llama a app.Run()
internal/
  app/                 composition root: config, pool, router y shutdown
    app.go             carga config, abre el pool, valida la conexión, sirve
    router.go          cablea repository -> service -> handler y monta /api/v1
  platform/            infraestructura transversal, sin lógica de negocio
    config auth httpx apperr middleware dbx page storage aiclient reqctx dbtest
  feature/             un paquete por dominio, con su lógica de negocio
    profile zones chat attachments materials events topics
```

Cada dominio de `feature/` repite la misma forma, y cada capa solo conoce a la de
abajo:

```text
model.go        tipos de dominio y constantes
requests.go     un struct por endpoint de entrada, con su Validate()
repository.go   SQL con pgx; recibe siempre el userID y lo mete en el WHERE
service.go      reglas de negocio y orquestación; no conoce HTTP ni SQL crudo
handler.go      declara las rutas y adapta HTTP a service vía httpx
```

La regla que sostiene la estructura: `feature/` depende de `platform/`, nunca al
revés, y un dominio no importa a otro. Cuando un dominio necesita algo de otro,
`app/` le inyecta una función. El único caso hoy es el chat, que recibe de
`profile` la función que registra la racha de estudio.

## Cómo funciona la seguridad

El backend se conecta como `service_role`, que hace bypass de RLS. Postgres, por
tanto, no protege los datos: la autorización está en el código y el contrato es
invariable. Todo repository recibe el `userID` y lo incluye en el `WHERE`. Un
`GET` sobre un recurso ajeno devuelve 404, no 403, para no revelar siquiera que
existe.

La red que sostiene ese contrato es una prueba de integración por repository,
`TestForeignUserGets404`, que verifica contra una base real que un usuario no ve
ni borra recursos de otro. Si algún query olvidara el filtro, esa prueba falla.

En la base de datos la RLS está habilitada sin ninguna policy, a propósito: así
se cierra el acceso directo por PostgREST. Añadir una policy permisiva abriría un
agujero en lugar de cerrarlo.

## El viaje de una petición

Ejemplo no-streaming, `POST /api/v1/zones` con `Authorization: Bearer <jwt>`:

```text
1. recover        convierte cualquier panic en un 500 limpio
2. request-id     asigna un id que va en cada log y en la respuesta
3. logger         registra método, ruta, status y duración
4. cors           cabeceras CORS
5. auth           valida el JWT y mete el user_id en el context (401 si falla)
6. timeout        30s por defecto (se omite en streaming)
7. rate-limit     solo en endpoints que cuestan IA
   handler        httpx.Decode corta el body a 1 MB, rechaza campos desconocidos
                  y corre Validate(); RequireUser saca el user_id del context
   service        aplica la regla de negocio
   repository     ejecuta SQL parametrizado filtrado por userID
   respuesta      { data, meta: { request_id } } o, si hubo error,
                  { error: { code, message }, meta }
```

El handler nunca escribe el status a mano. Un error de dominio se mapea solo
(NotFound a 404, VALIDATION_ERROR a 400, y demás) y uno desconocido cae a
INTERNAL (500), que se registra completo pero no se expone al cliente.

El chat es el único endpoint que responde por SSE. Se aparta del flujo anterior
en tres puntos: no lleva timeout global (el streaming es largo a propósito),
mantiene un heartbeat cada 15 segundos para que los proxies no corten la conexión
mientras la IA produce el primer token, y persiste la respuesta con
`context.WithoutCancel` para no perderla si el cliente se desconecta a media
generación. Antes de pasar a modo streaming valida el cuerpo y verifica que la
conversación sea del usuario, de modo que un fallo previo devuelve un error JSON
normal.

El contexto que da forma a cada respuesta de IA no usa embeddings ni búsqueda
vectorial: se arma con SQL plano en `chat/repository.go` (`GatherContext`), que
reúne el perfil, los objetivos de la zona y el texto extraído de los últimos
documentos, con un presupuesto de tokens que trunca el excedente.

## Pruebas

```bash
go test ./...                                   # unitarias, rápidas, sin DB
set -a && . ./.env && set +a && go test ./...   # + integración contra la DB real
```

Hay dos capas:

- Unitarias: el `Validate()` de cada request, el constructor del prompt del chat,
  el cursor keyset y el mapeo error a status. Corren sin base de datos.
- Integración: el `TestForeignUserGets404` de cada repository, más una prueba en
  `materials` que inserta cada tipo válido para detectar cualquier deriva entre
  el código y el CHECK de la base. Se saltan si no hay `DATABASE_URL`.
