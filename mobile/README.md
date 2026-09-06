# Módulo Mobile

Cliente móvil multiplataforma de Foxy, en React Native (Expo). **Aún no
implementado**: este directorio es el marcador del módulo.

Consume la API del backend Go (`/api/v1`); nunca llama al ai-service directo.
El contrato que debe seguir está en
[../docs/mobile-integration.md](../docs/mobile-integration.md).

## Responsabilidades (previstas)

- Interfaz para estudiantes y docentes.
- Autenticación con Supabase Auth y consumo de la API del backend.
- Subida de documentos a Supabase Storage mediante URL firmada.
- Chat por streaming (SSE) y visualización del material generado
  (flashcards, exámenes, resúmenes).

## Puesta en marcha

```bash
npm install
npm start
```

Abre Expo: se escanea el QR con Expo Go o se pulsa `a` para un emulador Android.
`npm run web` levanta la app en el navegador, útil solo para revisar layout.
