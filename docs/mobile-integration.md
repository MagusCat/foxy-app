# Consumir la API desde React Native / Expo

Recomendaciones atadas a cómo funciona **este** backend. Resumen de arquitectura
en [architecture.md](architecture.md).

---

## 1. Autenticación: el JWT lo pone Supabase, no el backend

El backend **no tiene login**. La app se autentica con **Supabase Auth** y manda
en cada petición el `access_token` que Supabase emite.

```ts
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import 'react-native-url-polyfill/auto'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
})
```

Reglas:

- **Nunca** metas `SUPABASE_SERVICE_ROLE_KEY` en la app. Solo la usa el backend.
- Usa la **anon key** (pública) para el login; el `access_token` resultante es lo
  que va en `Authorization: Bearer …` hacia el backend Go.
- `supabase-js` refresca el token solo. Toma el token **fresco en cada request**
  (abajo), no lo guardes en una variable que se queda vieja.
- Guarda la sesión en `expo-secure-store` si quieres cifrado en reposo.

---

## 2. Un cliente HTTP que entienda el *envelope*

Toda respuesta viene envuelta. Éxito: `{ "data": …, "meta": { "request_id" } }`.
Error: `{ "error": { "code", "message", "details" }, "meta": … }`. Centraliza el
desenvuelto y el token en un solo lugar.

```ts
export class ApiError extends Error {
  constructor(public code: string, message: string, public details?: {field:string;message:string}[], public status?: number) {
    super(message)
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const e = body?.error
    throw new ApiError(e?.code ?? 'UNKNOWN', e?.message ?? 'Error', e?.details, res.status)
  }
  return body.data as T
}
```

- Ramifica tu lógica por **`error.code`** (estable), no por el texto `message`
  (legible, puede cambiar).
- En un `VALIDATION_ERROR` (400) usa `error.details[].field` para marcar campos.
- Errores que conviene manejar explícitamente:

| code | status | Qué hacer en la app |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Refrescar sesión; si falla, mandar a login. |
| `RATE_LIMITED` | 429 | Backoff + avisar "vas muy rápido". |
| `AI_UNAVAILABLE` | 502 | Reintentar o degradar (la IA no está lista). |
| `VALIDATION_ERROR` | 400 | Pintar errores por campo. |

---

## 3. Datos: usa TanStack Query

Deja el desenvuelto del envelope en el `queryFn` y que React Query maneje caché,
reintentos y estados. **No reintentes los 4xx.**

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, err) => (err instanceof ApiError && err.status! < 500 ? false : n < 2),
    },
  },
})

const useZones = () => useQuery({ queryKey: ['zones'], queryFn: () => api<Zone[]>('/zones') })
```

---

## 4. Paginación: cursor keyset, no páginas

Las listas devuelven `meta.next_cursor`. Mándalo como `?cursor=` para la siguiente
página; cuando venga vacío, ya no hay más. **No hay `offset`.**

```ts
useInfiniteQuery({
  queryKey: ['messages', convId],
  queryFn: ({ pageParam }) =>
    apiRaw(`/conversations/${convId}/messages?limit=30${pageParam ? `&cursor=${pageParam}` : ''}`),
  getNextPageParam: (last) => last.meta.next_cursor || undefined,
})
```

(`apiRaw` es como `api` pero devuelve `{data, meta}` sin desenvolver, para ver el
cursor.) Engancha `onEndReached` del `FlatList` a `fetchNextPage`.

---

## 5. Chat en streaming (SSE) — el punto delicado en RN

`POST /conversations/{id}/messages` responde **`text/event-stream`**, no JSON. El
`EventSource` nativo del navegador no existe en RN y no manda cabeceras. Dos
opciones que sí sirven:

**A. `react-native-sse`** (soporta headers, la más simple):

```ts
import EventSource from 'react-native-sse'

const es = new EventSource(`${API_BASE_URL}/api/v1/conversations/${id}/messages`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content }),
})
es.addEventListener('token', (e) => appendToBubble(JSON.parse(e.data).content))
es.addEventListener('done',  (e) => finalize(JSON.parse(e.data).message_id))
es.addEventListener('error', (e) => showError())    // p.ej. AI_UNAVAILABLE
```

**B. `expo/fetch` con streaming** (Expo SDK 52+): `fetch` de `expo/fetch` devuelve
un `ReadableStream`; parsea las líneas `event:`/`data:` a mano.

Eventos del backend: `token` (cada fragmento), `done` (`{message_id, token_count}`)
y `error` (`{code, message}`).

**Desconexión:** si el usuario cierra la app a media respuesta, el backend
**persiste lo ya generado**. Al reconectar, basta volver a pedir los mensajes de la
conversación; no reenvíes el mensaje.

---

## 6. Subir archivos: flujo de 3 pasos

El binario **no pasa por el backend**. Secuencia:

```
1) POST /attachments/upload-url  { file_name, mime_type, size_bytes }
      → { upload_url, storage_path }
2) PUT  <upload_url>  (el binario, con su Content-Type)
3) POST /attachments  { storage_path, file_name, mime_type, size_bytes, conversation_id? }
      → registra y dispara la extracción de texto
```

```ts
import * as FileSystem from 'expo-file-system'

const { upload_url, storage_path } = await api('/attachments/upload-url', {
  method: 'POST', body: JSON.stringify({ file_name, mime_type, size_bytes }),
})
await FileSystem.uploadAsync(upload_url, fileUri, {
  httpMethod: 'PUT', headers: { 'Content-Type': mime_type },
})
const attachment = await api('/attachments', {
  method: 'POST', body: JSON.stringify({ storage_path, file_name, mime_type, size_bytes }),
})
```

- Tipos aceptados hoy: **PDF, PNG/JPEG/WebP, TXT/Markdown, DOCX, PPTX**; tope
  **25 MB**. Filtra en la app (con `expo-document-picker`) para fallar rápido.
- La extracción de texto es asíncrona: el adjunto queda con
  `processing_status: 'pending'` y pasa a `ready`/`failed`. Refresca o consulta
  `GET /attachments/{id}` para saber cuándo está.

---

## 7. Contratos de datos (enums) — manténlos en sync

La app y la API deben coincidir en los valores cerrados. Espeja estos como uniones
TypeScript (fuente: `docs/schemas/schema_v2.sql`):

```ts
type UserKind       = 'student' | 'teacher' | 'professional'
type AcademicLevel  = 'secundaria' | 'preparatoria' | 'universidad' | 'posgrado' | 'autodidacta'
type MaterialType   = 'summary' | 'flashcards' | 'exam' | 'assignment' | 'notes'
type EventKind      = 'class' | 'exam' | 'due' | 'session' | 'reminder'
```

> `material` type es el que más fácil se desincroniza: si mandas uno fuera de esa
> lista, el backend responde `VALIDATION_ERROR`.

---

## 8. Configuración y gotchas de red

- **URL base por entorno**, nunca hardcodeada. En dispositivo físico `localhost`
  es el teléfono, no tu máquina: usa la IP LAN o un túnel. Con `expo-constants` /
  `app.config.ts`:

  ```ts
  export const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl
  ```
- En Android, `http://` en dev necesita `usesCleartextTraffic` (o usa `https`).
- No llames a PostgREST/Supabase DB directo desde la app: la RLS está **sin
  policies** a propósito (no obtendrías nada). Todo pasa por el backend Go.

---

## 9. Checklist rápido

- [ ] Login con Supabase Auth; token fresco en cada request.
- [ ] Cliente central que desenvuelve `{data}` y lanza `ApiError(code, …)`.
- [ ] Manejo explícito de 401 / 429 / 502 / 400.
- [ ] TanStack Query con retry que ignora 4xx.
- [ ] Paginación por `next_cursor`.
- [ ] Chat con `react-native-sse` (o `expo/fetch`), maneja `token`/`done`/`error`.
- [ ] Subida en 3 pasos con filtro de tipo/tamaño en cliente.
- [ ] Enums espejados desde `schema_v2.sql`.
- [ ] URL base por entorno.
