# TrivIAndo — Backend

Backend del servidor de TrivIAndo: una aplicación en TypeScript que expone una API REST y WebSockets (Socket.IO) para jugar trivias en tiempo real, almacenar resultados y aprovechar generación de contenido con AI.

## Contenido

- Visión general
- Tecnologías
- Requisitos
- Instalación y ejecución
- Variables de entorno
- Scripts disponibles
- Documentación API (OpenAPI/Swagger)
- Notas sobre WebSockets y timers (escalado)
- Estructura del proyecto
- Tests y cobertura
- Contribución y próximos pasos

## Visión general

El backend gestiona salas, preguntas, resultados y la lógica de juego en tiempo real. Utiliza Socket.IO para la comunicación en tiempo real entre clientes y servidor, MongoDB para persistencia y Redis para funcionalidades de cache/pubsub cuando aplica.

También contiene integración con servicios de generación de contenidos (paquete `@google/generative-ai` está presente) para características AI (p. ej. generación de preguntas o descripciones).

## Tecnologías principales

- Node.js + TypeScript
- Express (API REST)
- Socket.IO (real-time)
- MongoDB (mongoose)
- Redis (ioredis, adapter para Socket.IO)
- Jest (tests)
- ESLint (linting)
- Swagger / OpenAPI para documentación (`src/docs/openapi.yaml`)

## Requisitos

- Node.js (versión LTS recomendada, >=18)
- npm (o yarn)
- MongoDB (local o remoto)
- Redis (opcional, recomendado para scaling de sockets)

## Instalación

1. Clona el repositorio

2. Instala dependencias

```
npm install
```

3. Crea un archivo `.env` en la raíz con las variables de entorno necesarias (ver sección siguiente).

## Variables de entorno (ejemplos)

Las variables usadas por la app (ajusta según tu entorno):

- `PORT` - puerto en el que corre el servidor (por defecto 3000)
- `MONGO_URI` - URI de conexión a MongoDB
- `REDIS_URL` - URL de Redis (ej. redis://localhost:6379) — opcional pero recomendado para producción y scaling de sockets
- `JWT_SECRET` - clave para firmar JWT
- `GOOGLE_API_KEY` o `GOOGLE_APPLICATION_CREDENTIALS` - credenciales para la integración de la librería de generación AI (si se utiliza)
- `NODE_ENV` - `development` | `production`

Ejemplo mínimo `.env`:

```text
PORT=3000
MONGO_URI=mongodb://localhost:27017/triviando
REDIS_URL=redis://localhost:6379
JWT_SECRET=changeme
NODE_ENV=development
```

## Scripts útiles

Los scripts disponibles en `package.json` (usa `npm run <script>`):

- `dev` — Ejecuta en modo desarrollo con recarga (ts-node-dev)
- `build` — Compila TypeScript y copia archivos de docs a `dist`
- `start` — Ejecuta el build (`node dist/server.js`)
- `test` — Ejecuta tests con Jest y genera cobertura
- `lint` — Ejecuta ESLint
- `lint:fix` — Ejecuta ESLint y aplica arreglos automáticos

Ejemplos (PowerShell):

```powershell
npm run dev     # desarrollo
npm run build   # compilar
npm start       # ejecutar build en producción
npm test        # correr tests
```

## Documentación de la API

La especificación OpenAPI se encuentra en `src/docs/openapi.yaml`. Mientras el servidor está corriendo, la documentación Swagger UI está disponible en `/api-docs` (o en la ruta que el servidor configure).

## WebSockets, timers y notas de despliegue

El juego usa timers en memoria (revisa `src/services/game.service.ts` -> `timersMap` y `scheduleTimer`) para coordinar la secuencia de preguntas, abrir/cerrar ventanas y timeouts. Esto funciona bien en despliegues de una sola instancia, pero tiene implicaciones cuando escales horizontalmente:

- En-memory timers no se comparten entre instancias. Pueden provocar timers duplicados, eventos perdidos o comportamientos inconsistentes.

Opciones para producción multi-instancia:

- Mover la coordinación a un scheduler centralizado (p. ej. Redis TTL + worker, BullMQ, Agenda o un worker dedicado).
- Usar Redis (o equivalente) para pub/sub y coordinar eventos entre instancias.
- Mantener una única instancia "líder" responsable de timers (requiere electión de líder y detección de fallos).

Si planeas desplegar en múltiples réplicas, documenta la estrategia elegida y modifica `game.service` para usar la solución centralizada.

Además, para Socket.IO se recomienda configurar el adapter Redis (`@socket.io/redis-adapter`) cuando haya más de una instancia.

## Estructura del proyecto (resumen)

- `src/` — código fuente principal
	- `app.ts` — configuración de express y middleware
	- `server.ts` — arranque del servidor
	- `config/` — configuración (Mongo, Redis, Swagger)
	- `controllers/` — endpoints REST
	- `services/` — lógica de negocio y timers (incluye `game.service.ts`)
	- `models/` — esquemas mongoose
	- `socket/` — handlers y lógica de sockets
	- `middleware/` — auth, error handler, socketAuth
	- `utils/` — helpers (token, redis helpers, password utils)
- `tests/` — tests unitarios/integración (Jest + supertest)
- `docs/` o `src/docs/` — OpenAPI y documentación relacionada
- `coverage/` — reportes de cobertura tras ejecutar tests

## Tests y cobertura

Ejecuta:

```powershell
npm test
```

El reporte de cobertura se genera en la carpeta `coverage/` y también hay un reporte HTML en `coverage/lcov-report` para revisión local.

## Contrato breve de la API y websocket (útil para tests)

- Inputs: requests HTTP JSON para endpoints REST; eventos Socket.IO con payloads JSON para acciones en tiempo real (unirse a sala, responder, iniciar juego).
- Outputs: respuestas JSON (REST) y eventos Socket.IO (emit/broadcast) con estados de juego y resultados.
- Errores comunes: token JWT inválido/expirado (401), payloads inválidos (400), problemas de DB (500). Manejo centralizado en `middleware/errorHandler.ts`.

Edge cases importantes:

- Clientes desconectados durante una partida (reconexión y re-sincronización de estado).
- Timers y race conditions en setups multi-instancia.
- Latencias de Redis/Mongo que afecten al flujo en tiempo real.

## Contribuir

Si quieres contribuir:

1. Crea un fork y rama con un nombre claro.
2. Añade tests para nuevas funcionalidades o correcciones.
3. Ejecuta `npm run lint` y `npm test` antes de crear PR.
4. Abre un PR con descripción clara y referencias a issues.

## Próximos pasos recomendados

- Añadir un `Dockerfile` y `docker-compose` para facilitar despliegues locales.
- Integrar CI (GitHub Actions) para lint, build y tests en cada PR.
- Exponer badges (build, coverage, npm version) en el README.
- Si usas la funcionalidad AI, documentar los requisitos de credenciales y permisos.

## Troubleshooting rápido

- 500 al arrancar: revisa `MONGO_URI` y que Mongo esté alcanzable.
- Problemas de sockets en producción: configura `REDIS_URL` y habilita el adapter para Socket.IO.
- Tests que fallan por puertos en uso: verifica que ninguna instancia del servidor quede en segundo plano.