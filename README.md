# TrivIAndo — Backend

## Integrantes:
- Natalia Espitia Espinel
- Mayerlly Suárez Correa
- Jesús Alberto Jauregui Conde

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Pokesaurios_triviando-backend&metric=alert_status&token=88e1d8129af6360bb8859bc4ca300010cb528328)](https://sonarcloud.io/summary/new_code?id=Pokesaurios_triviando-backend)

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

El backend gestiona salas, preguntas, resultados y la lógica de juego en tiempo real. Utiliza Socket.IO para la comunicación en tiempo real entre clientes y servidor, MongoDB para persistencia y Redis para funcionalidades de caché/pubsub cuando aplica.

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

## CI & Calidad (SonarCloud)

Requisitos en SonarCloud (configurar en la UI de SonarCloud):

- Quality Gate personalizado que exija los umbrales deseados:
  - Coverage (Lines) ≥ 80%
  - Maintainability Rating = A
  - Reliability Rating = A
  - Security Rating = A
  - Code duplication ≤ 3%
  - Code smells ≤ 10 per 1000 LOC
  - Complejidad y otras métricas que quieras controlar

Notas:

- La verificación de Quality Gate se realiza consultando la API de SonarCloud; el comportamiento de bloqueo depende de la configuración del Quality Gate en SonarCloud.

## Contrato breve de la API y websocket (útil para tests)

- Inputs: requests HTTP JSON para endpoints REST; eventos Socket.IO con payloads JSON para acciones en tiempo real (unirse a sala, responder, iniciar juego).
- Outputs: respuestas JSON (REST) y eventos Socket.IO (emit/broadcast) con estados de juego y resultados.
- Errores comunes: token JWT inválido/expirado (401), payloads inválidos (400), problemas de DB (500). Manejo centralizado en `middleware/errorHandler.ts`.

Edge cases importantes:

- Clientes desconectados durante una partida (reconexión y resincronización de estado).
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

## Contrato de eventos de Socket.IO (detallado)

Esta sección documenta los eventos y el estado intercambiado por los clientes del juego. Todos los identificadores de jugadores se exponen como `userId` (no `id`). Los puntajes se leen del mapa `scores` en el estado de juego; los objetos `players[]` ya no incluyen `score` para evitar duplicación.

- room:create (client → server)
  - Payload: `{ topic: string, maxPlayers?: number (2-20), quantity?: number (5-20) }`
  - Ack OK: `{ ok: true, room: { code, roomId, triviaId, maxPlayers, host: string, players: { userId, name, joinedAt }[], chatHistory: [] } }`
  - Broadcast: `room:update` `{ event: "roomCreated", code, roomId }`

- room:join (client → server)
  - Payload: `{ code: string }`
  - Ack OK: `{ ok: true, room: { code, players: { userId, name, joinedAt }[], chatHistory } }`
  - Broadcast: `room:update` `{ event: "playerJoined", player: { userId, name }, players: [...] }`
  - Errores comunes: `{ ok: false, message: "Room not found" | "Room full or not found" }`

- room:chat (client → server)
  - Payload: `{ code: string, message: string }` (máximo 400 caracteres)
  - Broadcast: `room:chat:new` `{ userId, user: name, message, timestamp }`

- room:reconnect (client → server)
  - Payload: `{ code: string }`
  - Ack OK: `{ ok: true, room: { code, players: { userId, name, joinedAt }[], chatHistory, gameState } }`

- game:start (host → server)
  - Payload: `{ code: string }`
  - Broadcast: `game:started` `{ ok: true, totalQuestions: number }`
    - Nota: `totalQuestions = preguntas_totales - 1` reservando 1 pregunta para posible desempate.

- game:update (server → room)
  - Emite siempre el estado completo persistido tras cada transición relevante.
  - Estado (`GameState`):
    - `roomCode: string`
    - `triviaId: string`
    - `status: 'waiting' | 'in-game' | 'finished' | 'open' | 'result' | 'reading' | 'answering'`
    - `currentQuestionIndex: number`
    - `roundSequence: number`
    - `scores: Record<userId, number>`
    - `blocked: Record<userId, boolean>`
    - `players: { userId: string, name: string }[]`
    - `questionReadEndsAt?: number` — timestamp UNIX ms del fin de lectura
    - `answerWindowEndsAt?: number` — timestamp UNIX ms del fin de la ventana del ganador
    - `tieBreakerPlayed?: boolean`

- round:showQuestion (server → room)
  - `{ roundSequence, questionText, readMs }`

- round:openButton (server → room)
  - `{ roundSequence, pressWindowMs }`

- round:buttonPress (client → server)
  - Payload: `{ code: string, roundSequence: number, eventId?: string }`
  - Ack OK: `{ ok: true, message: "You pressed first" }`
  - Ack errores:
    - `{ ok: false, message: "Stale round" }` si no coincide `roundSequence`
    - `{ ok: false, message: "Estás bloqueado para esta pregunta" }` si el jugador está bloqueado
    - `{ ok: false, message: "Otro jugador ganó el botón" }` si ya hubo otro primero

- round:playerWonButton (server → room)
  - `{ roundSequence, playerId: string, name: string }`

- round:answerRequest (server → ganador)
  - `{ roundSequence, options: string[], answerTimeoutMs: number, endsAt: number }`

- round:answer (ganador → server)
  - Payload: `{ code: string, roundSequence: number, selectedIndex: number, eventId?: string }`
  - Ack, OK:
    - Correcta: `{ ok: true, correct: true }`
    - Incorrecta: `{ ok: true, correct: false }`
  - Ack error si responde otro jugador: `{ ok: false, message: "No eres quien está respondiendo" }`

- round:result (server → room)
  - Correcta: `{ roundSequence, playerId, correct: true, correctAnswer, scores }`
  - Incorrecta / timeout / nadie presionó: incluye `correct: false | null`, `message`, y `scores` (y `correctAnswer` si aplica)

- game:ended (server → room)
  - `{ scores: Record<userId, number>, winner: { userId, name, score } }`

Notas operativas clave
- Limpieza de ventanas: el servidor limpia `answerWindowEndsAt` al resolver la ronda (correcta/incorrecta/timeout/nadie).
- Timers: se programan con claves por sala y secuencia de ronda; al ejecutar, se borran del registro.
- Dedupe/Concurrencia: `eventId` opcional para deduplicar; la primera pulsación se determina con `SETNX PX` en Redis.
- Reconexión: los timestamps `questionReadEndsAt`/`answerWindowEndsAt` permiten re-sincronizar la UI del cliente al reconectar.

## 🛡️ Demostración de Seguridad (Escenario 2)

Este proyecto incluye una demostración completa del **Escenario 2: Prevención ante ataques comunes**.

### Inicio Rápido

```bash
# Configurar demostración
./setup-demo.sh        # Linux/Mac
.\setup-demo.ps1       # Windows

# Ejecutar demostración completa
npm run demo:jury

# Ver reporte HTML
start audit/security-audit.html  # Windows
open audit/security-audit.html   # macOS
```

### Comandos Disponibles

```bash
npm run audit:security    # Análisis estático de seguridad
npm run demo:attacks      # Demo visual de ataques bloqueados
npm run test:security     # Suite de 150+ tests de seguridad
npm run audit:full        # Auditoría completa (estático + dinámico)
```

### Métricas de Seguridad

| Métrica | Objetivo | Estado |
|---------|----------|--------|
| Cobertura de Validación | 100% | ✅ |
| Vulnerabilidades | 0 | ✅ |
| Tests de Seguridad | 150+ pasando | ✅ |
| Score de Seguridad | 90+/100 | ✅ |

### Documentación

- [Guía completa de demostración](./docs/SCENARIO-2-DEMONSTRATION.md)
- [README de demostración rápida](./docs/SECURITY-DEMO-README.md)

### Evidencia

- **Tests:** `tests/security.attacks.test.ts` - 150+ tests cubriendo 10 categorías de ataques
- **Análisis:** `scripts/security-audit.ts` - Auditoría automatizada de código
- **Demo:** `scripts/live-attack-demo.ts` - Demostración visual en vivo
- **Reportes:** `audit/security-audit.html` - Dashboard interactivo de seguridad

