# Arquitectura del backend (Go)

Este documento explica cómo está organizado el backend, qué hace cada carpeta y
cómo viaja una petición de punta a punta.

---

## 1. El sistema en una imagen

```
┌─────────────┐     HTTPS/JSON      ┌──────────────────┐     HTTP      ┌──────────────┐
│ App móvil   │ ──── Bearer JWT ──▶ │  Backend Go      │ ───────────▶ │  ai-service  │
│ (RN/Expo)   │ ◀─── envelope ───── │  (este repo)     │ ◀─ SSE/JSON  │  (Python)    │
└─────────────┘                     └───────┬──────────┘               └──────────────┘
      │                                     │ pgx (service_role)
      │ sube binario directo                ▼
      │ a signed URL              ┌──────────────────┐
      └─────────────────────────▶ │ Supabase         │
                                  │ Postgres · Auth  │
                                  │ · Storage        │
                                  └──────────────────┘
```

- La app nunca toca la DB directo. Habla solo con el backend Go.
- El backend nunca guarda contraseñas. Supabase Auth emite el JWT; Go lo
  valida con la llave pública (JWKS) y saca el `user_id` del claim `sub`.
- Los archivos no pasan por el backend. Go firma una URL y el móvil sube el
  binario directo a Storage.

---

## 2. Las dos raíces: `platform/` y `feature/`

```
internal/
  app/          composition root — el único que conoce a todos
  platform/     infraestructura transversal, sin lógica de negocio
  feature/      un paquete por dominio, con su lógica de negocio
```

La regla mental: `feature/` depende de `platform/`, nunca al revés, y un
`feature` no importa a otro `feature` (si necesita algo de otro, se le inyecta una
función desde `app/`). Así un cambio de negocio toca una carpeta y la
infraestructura queda estable.

---

## 3. `app/` — el arranque

| Archivo | Qué hace |
|---|---|
| `app.go` | Carga config, abre el pool de Postgres (afinado para el pooler de Supabase), valida que puede conectar, construye el router y corre el servidor con *graceful shutdown*. |
| `router.go` | Cablea cada módulo (`repository → service → handler`), monta sus rutas bajo `/api/v1` y les aplica la cadena de middleware. Es el único lugar donde se "arma" todo. |

`cmd/api/main.go` solo llama a `app.Run()`. Nada de lógica en `main`.

---

## 4. `platform/` — la infraestructura

| Paquete | Responsabilidad |
|---|---|
| `config` | Lee variables de entorno a un struct. Si falta un secreto, el proceso no arranca (falla al boot, no a media petición). |
| `httpx` | El pegamento HTTP: *envelope* de respuesta, `Decode` (decode+validate del body), helpers `Handle*` que quitan el esqueleto repetido de cada handler, y el mapeo error→status. |
| `apperr` | Errores de dominio tipados (`ErrNotFound`, `VALIDATION_ERROR`, …) con su código estable y su status HTTP. Los `service` los devuelven; `httpx` los traduce. |
| `middleware` | La cadena: `recover → request-id → logger → cors → auth → rate-limit`. El rate-limit (en memoria, por usuario) solo se aplica a endpoints que cuestan dinero (IA). |
| `auth` | Valida el JWT de Supabase contra el JWKS (cachea y rota las llaves), verifica `exp/iss/aud` y mete el `user_id` en el context. |
| `reqctx` | Guarda/lee el `request-id` y el usuario autenticado en el `context.Context`. |
| `dbx` | Helpers de colección de filas con `pgx` (`One`, `Many`): centralizan el mapeo `ErrNoRows → NotFound`. |
| `page` | Cursor keyset compartido (paginación estable que no se degrada al crecer). |
| `storage` | Firma URLs de subida de Supabase Storage. |
| `aiclient` | Cliente HTTP hacia el `ai-service`, incluyendo streaming SSE y un modo stub para desarrollar sin él. |
| `dbtest` | Setup compartido de los tests de integración (siembra usuarios, limpia). Solo lo usan los `_test.go`. |

---

## 5. `feature/` — los dominios

Cada paquete tiene las mismas piezas, y cada capa solo conoce a la de abajo:

```
model.go        Tipos de dominio (structs con tags db/json) y constantes.
requests.go     Un struct por endpoint de entrada, con su Validate().
                (a veces dentro de model.go si el paquete es chico)
repository.go   SQL con pgx. Recibe SIEMPRE el userID y lo mete en el WHERE.
                Devuelve modelos o apperr.ErrNotFound.
service.go      Reglas de negocio y orquestación. No conoce http ni SQL crudo.
handler.go      Declara las rutas (Routes()) y adapta HTTP↔service vía httpx.
```

| Dominio | Cubre |
|---|---|
| `profile` | Perfil del usuario, racha de estudio, catálogo de profesiones. |
| `zones` | Zonas de estudio (personales o colaborativas), miembros, join por código, objetivos y progreso. |
| `chat` | Conversaciones, mensajes, historial paginado y respuesta de IA por SSE. |
| `attachments` | Registro de archivos subidos a Storage y disparo de la extracción de texto. |
| `materials` | Material generado por IA (resumen, flashcards, examen, tarea, apuntes) e intentos de examen. |
| `events` | Agenda/calendario: clases, exámenes, entregas, sesiones, recordatorios. |
| `topics` | Temas que organizan una zona de estudio. |

### El system prompt del chat

La persona de Foxy vive en archivos, no en código, bajo
`internal/feature/chat/prompts/` (embebidos con `go:embed`):

```
prompts/
  base.md          persona común
  student.md       enfoque para estudiante
  teacher.md       enfoque para docente
  professional.md  enfoque para profesional
```

El prompt final se compone así: `base` (o el override de `FOXY_SYSTEM_PROMPT`)
+ el archivo del `user_kind` del perfil + el contexto del usuario (nivel
académico, objetivo, objetivos de la zona, texto de sus documentos y sus
`custom_instructions`). Para cambiar el tono de Foxy se editan esos `.md`, sin
tocar código; `FOXY_SYSTEM_PROMPT` sobreescribe solo el `base` en runtime.

---

## 6. El viaje de una petición

Ejemplo: `PATCH /api/v1/me` con `Authorization: Bearer <jwt>`.

```
1. recover        atrapa cualquier panic y lo vuelve un 500 limpio
2. request-id     asigna un id a la petición (va en cada log y en la respuesta)
3. logger         registra método, ruta, status y duración
4. cors           cabeceras CORS
5. auth           valida el JWT, mete el user_id en el context (401 si falla)
6. rate-limit     (solo endpoints de IA)
   ── handler ──  httpx.Decode: corta el body a 1 MB, rechaza campos desconocidos,
                  corre Validate(). Extrae el user_id del context.
   ── service ──  aplica la regla de negocio
   ── repository  UPDATE ... WHERE id = $userID → devuelve el modelo o NotFound
   ── httpx ───   envuelve en { "data": ..., "meta": { "request_id": ... } }
                  o, si hubo error, en { "error": { "code", "message" }, "meta" }
```

El handler nunca escribe el status a mano: un error de dominio se mapea solo
(`NotFound → 404`, `VALIDATION_ERROR → 400`, …) y uno desconocido cae a `INTERNAL`
(500) logueado completo pero sin exponer el detalle al cliente.

---

## 7. El modelo de seguridad (léelo)

El backend se conecta con `service_role`, que hace bypass de RLS. Eso
significa que Postgres no te protege: la autorización vive en el código.

- Contrato invariable: todo repository recibe el `userID` y lo mete en el
  `WHERE`. Un `GET /zones/{id}` de un recurso ajeno devuelve 404 (no 403), para
  no filtrar siquiera que existe.
- La red que lo sostiene: cada repository tiene un `TestForeignUserGets404`
  que lo verifica contra una DB real. Si algún día un query olvida el `WHERE`, ese
  test se pone rojo.
- RLS habilitada sin policies en la DB, a propósito: cierra la puerta de
  PostgREST directo. Añadir una policy permisiva abriría un agujero, no lo
  cerraría.
- Permisos de app (admin/auditor) salen de `profiles.system_role`, nunca del
  claim `role` del JWT (que el usuario no puede modificar, pero tampoco usamos).

> Techo consciente: el rate-limit y este modelo asumen una sola instancia. Si
> se escala horizontalmente, el rate-limit va a Redis y, si aparece multi-tenant
> real, se migra a propagar el JWT con `SET LOCAL request.jwt.claims` y dejar que
> mande la RLS.

---

## 8. Dependencias externas y su estado

| Dependencia | Para qué | Si no está |
|---|---|---|
| Postgres (Supabase) | Toda la persistencia | El backend no arranca (`Ping` falla). |
| Supabase Auth (JWKS) | Validar el JWT | 401 en todo lo autenticado. |
| `ai-service` (Python) | Chat IA, generar material, extraer texto | Con `AI_SERVICE_URL=stub` responde de ejemplo; sin stub ni servicio → 502 en esos endpoints. |
| Supabase Storage | Subida de archivos | `/attachments/upload-url` falla al firmar. |

Límite duro de subidas: el `size_bytes`/`mime_type` que valida el backend es
una comprobación de borde (rechaza lo obviamente inválido con un 400 temprano);
una URL firmada no puede impedir que el cliente suba un archivo mayor o distinto.
El tope real se configura en el bucket de Supabase (`file_size_limit` +
`allowed_mime_types`). Configúralo al crear el bucket `attachments`.

---

## 9. Estrategia de pruebas

- Unitarias (sin DB, siempre corren): `Validate()` de cada request, el
  constructor de prompt del chat, el cursor keyset, el mapeo error→status.
- Integración (con DB real, `_test.go` que se saltan sin `DATABASE_URL`): el
  `TestForeignUserGets404` por repository. `materials` además inserta cada tipo
  válido para cazar cualquier deriva entre `validTypes` y el CHECK de la DB.

```bash
cd backend
go test ./...                                 # solo unitarias
set -a && . ./.env && set +a && go test ./...    # + integración
```
