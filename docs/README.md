# Documentación
## ¿Qué buscas?

| Necesito… | Ve a |
|---|---|
| Levantar el proyecto completo | [README raíz](../README.md) |
| Arquitectura interna del backend, seguridad y viaje de una petición | [architecture.md](architecture.md) |
| Todas las variables de entorno y cuáles deben coincidir | [configuration.md](configuration.md) |
| Diagrama | [schemas/README.md](schemas/README.md) |
| Esquema de la base de datos | [schemas/schema_v3.sql](schemas/schema_v3.sql) |
| Contrato del ai-service (OpenAPI) | [api-specs/ai-service.json](api-specs/ai-service.json) |

## Estructura

```text
docs/
├── architecture.md          Backend: estructura, seguridad, viaje de una petición
├── configuration.md         Variables de entorno de ambos servicios
├── api-specs/
│   └── ai-service.json       OpenAPI del ai-service (generado)
├── schemas/
│   ├── README.md             Guía de la base de datos (tablas, diagrama, convenciones)
│   ├── schema_v3.sql         Esquema de la base de datos (fuente de verdad)
│   └── schema_v3.dbml        El mismo esquema como diagrama
└── sources/                  Recursos (banner, diagrama de la DB)
```
