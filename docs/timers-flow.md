# Flujo de juego y temporizadores (Socket.IO + Redis + BullMQ)

Este documento explica, paso a paso, cómo funciona el flujo del juego en tiempo real y cómo se coordinan los temporizadores en una arquitectura escalada horizontalmente (varias VMs detrás de un Load Balancer) usando Socket.IO, Redis y BullMQ.

## Resumen de componentes y responsabilidades

- Estado del juego por sala: almacenado en Redis en `room:{code}:game` (JSON de `GameState`).
- Comunicación tiempo real: Socket.IO con adapter Redis (`@socket.io/redis-adapter`) para emitir eventos de sala entre instancias.
- Temporizadores:
  - Temporizadores locales (en memoria de proceso) para acciones breves y no críticas de consistencia global:
    - Abrir el botón tras el período de lectura.
    - Ventana de presión del botón cuando nadie presiona.
  - Temporizador distribuido (BullMQ) para el timeout de respuesta del ganador del botón (crítico, debe ejecutarse una sola vez en todo el clúster).
- Desduplicación:
  - Primer click (ganador del botón): Redis `SET NX PX` en `room:{code}:firstPress`.
  - Eventos con `eventId` (idempotencia cliente→servidor): `SADD room:{code}:eventIds` + `EXPIRE`.

## Constantes y claves

- `DEFAULT_QUESTION_READ_MS = 10000` (lectura de la pregunta)
- `MIN_BUTTON_DELAY_MS = 1000` – `MAX_BUTTON_DELAY_MS = 5000` (aleatorio para habilitar el botón)
- `PRESS_WINDOW_MS = 10000` (ventana para presionar si está abierto)
- `ANSWER_TIMEOUT_MS = 15000` (tiempo para que el ganador responda)
- Claves Redis:
  - Estado: `room:{code}:game`
  - Primer click: `room:{code}:firstPress`
  - Set de eventos: `room:{code}:eventIds`
  - JobId timeout de respuesta: `{code}:answerTimeout:{roundSequence}` (BullMQ)

## Flujo principal por ronda

Referencias de código:
- Arranque y handlers: `src/socket/game.handlers.ts`
- Lógica utilitaria de timers y estado: `src/services/game.service.ts`
- Timeout distribuido (worker): `src/services/timers.handlers.ts` + `src/queues/*`

### 1) Inicio de juego
1. Host emite `game:start`.
2. Se crea el estado inicial en Redis (`initGameState`) y se emite `game:started` con `totalQuestions`.
3. Se llama `startRound(code, io)` para iniciar la primera ronda.

### 2) Mostrar pregunta (fase de lectura)
1. `startRound` incrementa `roundSequence`, marca `status = "reading"`, y fija `questionReadEndsAt = now + DEFAULT_QUESTION_READ_MS`.
2. Emite `game:update` y `round:showQuestion` con la duración de lectura.
3. Se agenda un temporizador local (in‑memory) para, al cabo de `readMs + randomDelay`, abrir el botón.

### 3) Abrir botón y ventana de presión
1. Al dispararse el timer de apertura:
   - Limpia `firstPress` (`resetFirstPress`).
   - Cambia `status = "open"` y emite `game:update` + `round:openButton` con `pressWindowMs`.
2. Se agenda un segundo timer local para la “ventana de presión”: si nadie presiona en `PRESS_WINDOW_MS`, se considera “nadie presionó”.

### 4) Primer jugador que presiona el botón
1. Evento `round:buttonPress` con validaciones:
   - Dedupe opcional por `eventId` (set Redis).
   - Verifica `roundSequence` actual.
   - Verifica bloqueo por jugador (`state.blocked`).
2. Competición “primero en tiempo” mediante `SET NX PX` en `room:{code}:firstPress` con TTL `PRESS_WINDOW_MS`:
   - Si el `SET` retorna `OK`, ese jugador ganó el botón.
   - Si no, ya hubo un ganador.
3. Al ganar el botón:
   - `status = "answering"`, bloquea a los demás jugadores.
   - Calcula `answerWindowEndsAt = now + ANSWER_TIMEOUT_MS`, persiste estado y emite `game:update`.
   - Emite `round:playerWonButton` y, al jugador ganador, `round:answerRequest` (con opciones y `endsAt`).
   - Programa un JOB DISTRIBUIDO en BullMQ con `jobId = {code}:answerTimeout:{roundSequence}` y delay `ANSWER_TIMEOUT_MS`.

### 5) Timeout de respuesta (BullMQ)
1. Si el jugador ganador no responde a tiempo, BullMQ dispara el job `answerTimeout`.
2. El worker (`src/queues/timers.worker.ts`) procesa el job y delega en `handleWinnerTimeoutSafe(io, code, roundSequence, userId)`.
3. `handleWinnerTimeoutSafe` valida:
   - El estado existe y el `roundSequence` coincide (evitar carreras o rondas obsoletas).
   - Si `answerWindowEndsAt` aún no ha pasado, no hace nada (otro proceso lo manejará correctamente cuando corresponda).
4. Marca resultado por tiempo, emite `round:result` con `correct = false` para el jugador bloqueado y `game:update`.
5. Llama a `startRoundOpenButtonAgain` tras ~1200ms para reabrir el botón (con el jugador que falló bloqueado para esa ronda), de modo que otros participantes puedan intentar responder.

### 6) Jugador ganador envía respuesta (`round:answer`)
1. Dedupe opcional por `eventId`.
2. Verifica `roundSequence` y que el `firstPress` corresponda al usuario que responde.
3. Cancela el job distribuido del timeout de respuesta: `clearDistributedTimer({code}:answerTimeout:{roundSequence})`.
4. Evalúa la respuesta:
   - Correcta:
     - Suma puntaje, `status = "result"`, limpia bloqueos y ventana de respuesta.
     - Emite `round:result` y `game:update`.
     - Avanza `currentQuestionIndex += 1` y, tras ~1500ms, inicia nueva ronda o finaliza el juego si no hay más preguntas.
   - Incorrecta:
     - `status = "result"`, bloquea temporalmente al jugador que respondió.
     - Emite `round:result` y `game:update`.
     - Limpia `firstPress` y reabre el botón tras ~800ms para que otros jugadores intenten (con ventana de presión protegida por timer local). 

### 7) Nadie presiona
Si la ventana de presión expira sin `firstPress`:
1. `handleNoPresses` emite `round:result` revelando la respuesta correcta, actualiza estado a `result` y avanza a la siguiente pregunta.
2. Tras ~1200ms, inicia nueva ronda o finaliza.

### 8) Fin de juego y desempates
1. En `endGame` se ordenan puntajes y se detecta empate.
2. Si hay empate y existe una pregunta de reserva (último índice) y no se ha usado `tieBreakerPlayed`:
   - Se marca `tieBreakerPlayed = true`, se posiciona `currentQuestionIndex` en la reserva y se reinicia ciclo de ronda.
3. Si no hay desempate, se marca estado `finished`, se persiste `GameResult` y se emite `game:ended`/`game:finished`.

## Distribución, consistencia y garantías

- Adapter Redis de Socket.IO asegura que `io.to(code).emit(...)` alcance a todos los clientes conectados a cualquier VM.
- Uso de `roundSequence` en cada handler evita efectos de mensajes tardíos o jobs de una ronda anterior.
- Timeout de respuesta usa BullMQ (distribuido) para garantizar ejecución única en todo el clúster:
  - `jobId` único por ronda evita duplicados.
  - Al llegar una respuesta antes de tiempo, se llama `clearDistributedTimer` y el job se elimina si aún no se ejecutó.
- Los timers locales (abrir botón y ventana de presión) se usan sólo para UX; su desincronización no rompe consistencia global del juego. La fuente de verdad es el `GameState` en Redis y los eventos Socket.IO.

## Secuencia (resumen por escenarios)

### Escenario A — Respuesta correcta
1. `round:buttonPress` ganador → bloqueos y `status=answering` → programa BullMQ.
2. `round:answer` correcta → borra job BullMQ → emite resultado → avanza pregunta.

### Escenario B — Respuesta incorrecta
1. `round:buttonPress` ganador → bloqueos y `status=answering` → programa BullMQ.
2. `round:answer` incorrecta → borra job BullMQ → emite resultado → reabre botón (bloqueando al que falló) → si nadie presiona, revela respuesta.

### Escenario C — No responde a tiempo
1. `round:buttonPress` ganador → programa BullMQ.
2. No llega `round:answer` → BullMQ dispara → `handleWinnerTimeoutSafe` emite resultado por tiempo → reabre botón con bloqueos.

### Escenario D — Nadie presiona
1. Se abre botón → expira ventana de presión sin `firstPress` → `handleNoPresses` revela respuesta y avanza.

## Validaciones y pruebas sugeridas

- Con 2 VMs conectadas a la misma sala, verificar:
  - Eventos `game:update`, `round:*` llegan a ambos clientes.
  - Sólo un job BullMQ de timeout se ejecuta por ronda (respuesta tardía no duplica efectos).
- Forzar cada escenario (A, B, C, D) y confirmar:
  - Cambios de `status` correctos: `reading` → `open` → `answering`/`result` → siguiente ronda/fin.
  - Bloqueos se aplican correctamente.
  - `roundSequence` se incrementa por ronda y evita efectos de eventos obsoletos.
- Apagar una VM durante `ANSWER_TIMEOUT_MS`: el job debe ejecutar en la otra VM sin interrumpir el juego.

## Referencias de implementación

- `src/socket/game.handlers.ts`
- `src/services/game.service.ts`
- `src/services/timers.handlers.ts`
- `src/queues/bullmq.ts`, `src/queues/timers.queue.ts`, `src/queues/timers.worker.ts`
- `src/socket/index.ts`
