# Arquitectura del backend (Go)

```
┌─────────────┐      HTTPS/JSON     ┌──────────────────┐   HTTP       ┌──────────────┐
│ App móvil   │ ─── Bearer JWT ──▶  │  Backend Go      │ ──────────▶  │  ai-service  │
│ (RN/Expo)   │ ◀── envelope ─────  │  (este repo)     │ ◀─ SSE/JSON  │  (Python)    │
└─────────────┘                     └───────┬──────────┘              └──────┬───────┘
      │                                     │ pgx (service_role)             │
      │ sube binario directo                ▼                                │
      │ a signed URL              ┌──────────────────┐                       │
      └─────────────────────────▶ │ Supabase         │ ◀─────────────────────┘
                                  │ Postgres · Auth  │   document_chunks
                                  │ · Storage        │   Storage (solo lectura)
                                  └──────────────────┘
```

- La app nunca toca la DB directo. Habla solo con el backend Go.
- El backend nunca guarda contraseñas. Supabase Auth emite el JWT; Go lo
  valida con la llave pública (JWKS) y saca el `user_id` del claim `sub`.
- Los archivos no pasan por el backend. Go firma una URL y el móvil sube el
  binario directo a Storage.
- El `ai-service` es el único que toca `document_chunks` (embeddings) y el que
  lee los binarios de Storage para extraer su texto. No decide permisos: Go le
  entrega los ids de adjuntos ya autorizados y él busca solo dentro de esos.

---

## Las dos raíces: `platform/` y `feature/`

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

## `app/` — el arranque

| Archivo | Qué hace |
|---|---|
| `app.go` | Carga config, abre el pool de Postgres (afinado para el pooler de Supabase), valida que puede conectar, construye el router y corre el servidor con *graceful shutdown*. |
| `router.go` | Cablea cada módulo (`repository → service → handler`), monta sus rutas bajo `/api/v1` y les aplica la cadena de middleware. Es el único lugar donde se "arma" todo. |

`cmd/api/main.go` solo llama a `app.Run()`. Nada de lógica en `main`.

---

## `platform/` — la infraestructura

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
| `aiclient` | Cliente HTTP hacia el `ai-service`: streaming SSE, generación de material, extracción de texto, secreto compartido y propagación del request-id. Trae un modo stub para desarrollar sin él. |
| `dbtest` | Setup compartido de los tests de integración (siembra usuarios, limpia). Solo lo usan los `_test.go`. |

---

## `feature/` — los dominios

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
| `attachments` | Registro de archivos subidos a Storage y disparo de la extracción de texto, en un pool acotado de workers que el apagado ordenado espera. |
| `materials` | Material generado por IA (resumen, flashcards, examen, tarea, apuntes) e intentos de examen. |
| `events` | Agenda/calendario: clases, exámenes, entregas, sesiones, recordatorios. |
| `topics` | Temas que organizan una zona de estudio. |

### El system prompt del chat

**Go no redacta prompts.** Todos —la persona de Foxy, las instrucciones de
citado y el formato del material generado— viven en un único fichero del
ai-service, `ai-service/app/prompts.toml`, y se cargan al arrancar:

```
[persona]        persona común
[persona.kind]   una por user_kind: student, teacher, professional
[context]        plantillas para el perfil que manda Go, con {value}
[chat]           cuándo y cómo citar el material
[materials]      formato JSON exigido por cada tipo de material
```

El prompt final se compone en `app/prompts.py`: persona base + el
bloque del `user_kind` + un fragmento por cada dato del perfil que haya llegado
(nivel académico, meta, minutos de estudio, objetivos de la zona y sus
`custom_instructions`), siempre en el mismo orden. Cambiar el tono de Foxy es
editar el TOML; `PROMPTS_FILE` apunta a otra copia para probar variantes sin
reconstruir la imagen.

Están en el ai-service, y no en Go, porque son acoplamiento con el modelo (el
`json_mode` de DeepSeek exige la palabra "json" en el prompt) y porque es el
único servicio que puede evaluarlos contra un LLM. Go conserva lo que sí es
suyo: los datos y la autorización.

**El orden del prompt es una decisión de coste, no de estilo.** Los proveedores
cachean por prefijo exacto, así que va lo estable delante —persona, perfil,
historial, que solo crece por el final— y lo volátil al final: el material
recuperado se pega al último turno del usuario. Puesto en el `system`, como
estaba, cualquier cambio en los fragmentos invalidaba toda la conversación que
venía detrás. `system_for` es determinista y de orden fijo justamente por esto;
hay un test que lo sostiene.

### El reparto del contexto con el ai-service

El texto de los documentos NO viaja en este prompt. Go manda el perfil en crudo
(`aiclient.ChatContext`, sin redactar) y la lista de `attachment_id` que ese usuario puede ver
(`attachments.Repository.VisibleIDs`: los de la conversación más los de la zona,
siempre con `user_id` en el `WHERE`); el `ai-service` busca por similitud en
`document_chunks` y anexa los fragmentos relevantes.

| Pieza del prompt | Dueño | Fuente |
|---|---|---|
| Persona y variante por `user_kind` | ai-service | `app/prompts.toml` |
| Redacción del prompt a partir del perfil | ai-service | `app/prompts.py` |
| Perfil (datos): nivel, meta, minutos, instrucciones propias | Go | `profiles` |
| Objetivos de la zona | Go | `study_zone_objectives` |
| Historial reciente (20 mensajes) | Go | `messages` |
| Fragmentos del material subido, con el archivo del que salieron | ai-service | `document_chunks` |

Go manda también el `file_name` del adjunto al extraer. El ai-service lo guarda
con cada fragmento, lo rotula en el prompt y así la respuesta puede decir de qué
archivo sacó cada dato. El `storage_path` no sirve para eso: `storage.sanitize`
le quita acentos y espacios al nombre.

El motivo del reparto: la autorización es de Go, que es quien conoce membresías
y propiedad; la recuperación semántica es del ai-service, que es quien tiene el
modelo de embeddings. Recortar el texto a 6000 caracteres, como se hacía antes,
descartaba casi todo un PDF largo sin garantía de conservar lo relevante.

---

## El viaje de una petición

Ejemplo: `PATCH /api/v1/me` con `Authorization: Bearer <jwt>`.

```
1. recover        atrapa cualquier panic y lo vuelve un 500 limpio
2. request-id     asigna un id a la petición (va en cada log y en la respuesta)
3. logger         registra método, ruta, status y duración
4. cors           cabeceras CORS
5. auth           valida el JWT, mete el user_id en el context (401 si falla)
6. rate-limit     (solo endpoints de IA)
7. stream-cap     (solo rutas SSE) techo de streams simultáneos del proceso;
                  esas rutas no llevan WriteTimeout, así que nada más las acota
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

### Cómo se autentican los dos servicios entre sí

Ese secreto **no viaja**: es la clave con la que Go firma un JWT (HS256) para
cada llamada al ai-service.

```
iss  foxy-backend        aud  foxy-ai-service
sub  <user_id>           jti  <request_id>
exp  ahora + 5 min       scope  chat | generate | extract
```

Lo que compra cada campo:

| Campo | Qué evita |
|---|---|
| `exp` | Que una fuga sea acceso permanente. Antes el bearer era fijo y revocarlo obligaba a redesplegar los dos servicios |
| `scope` | Que un token emitido para conversar sirva contra `/v1/extract`, el único endpoint que lee todo el bucket con la service key |
| `sub` | Atribuir a un usuario lo que ocurre en el ai-service, incluido el gasto en tokens |
| `aud` / `iss` | Que un token de otro sistema con la misma clave valga aquí |

---

## Dependencias externas y su estado

| Dependencia | Para qué | Si no está |
|---|---|---|
| Postgres (Supabase) | Toda la persistencia | El backend no arranca (`Ping` falla). |
| Supabase Auth (JWKS) | Validar el JWT | 401 en todo lo autenticado. |
| `ai-service` (Python) | Chat IA, generar material, extraer texto e indexar/buscar el contexto documental | Con `AI_SERVICE_URL=stub` responde de ejemplo; sin stub ni servicio → 502 en esos endpoints. El chat sigue funcionando sin contexto documental si la búsqueda falla. |
| Supabase Storage | Subida de archivos | `/attachments/upload-url` falla al firmar. |

---