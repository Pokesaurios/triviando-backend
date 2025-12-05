# Contrato Socket - Frontend

Este documento describe los eventos de socket, payloads y reglas de tiempo que el frontend debe seguir para interactuar correctamente con el backend del juego.

Principios clave
- El servidor es la fuente de verdad para ventanas temporales. Nunca confiar en contadores locales sin sincronizar con `endsAt` o timestamps enviados por el servidor.
- Todos los tiempos están en milisegundos (Number) y `endsAt` es un timestamp UNIX en ms.

Eventos principales (orden típico)

1. `game:started`
   - Emite: `{ ok: true, totalQuestions: number }`
   - Significado: el juego ha comenzado, el frontend puede prepararse para recibir la primera pregunta.

2. `round:showQuestion`
   - Emite: `{ roundSequence: number, questionText: string, readMs: number }`
   - Significado: mostrar la pregunta y bloquear el botón hasta que finalice la lectura.
   - Frontend: calcular `questionReadEndsAt = Date.now() + readMs` o usar `game:update` si incluye `questionReadEndsAt`.

3. `round:openButton`
   - Emite: `{ roundSequence: number, pressWindowMs: number }`
   - Significado: el botón para presionar queda habilitado por `pressWindowMs` ms.
   - Frontend: habilitar la UI del botón y comenzar cuenta regresiva basada en `pressWindowMs`.

4. `round:playerWonButton`
   - Emite: `{ roundSequence, playerId, name }` a la sala cuando alguien gana el botón.

5. `round:answerRequest`
   - Emite (solo al ganador): `{ roundSequence, options: string[], answerTimeoutMs: number, endsAt: number }`
   - Significado: el jugador que ganó puede responder; `endsAt` es timestamp ms; `answerTimeoutMs` es la duración en ms.
   - Frontend: mostrar opciones y usar `endsAt` para countdown. Deshabilitar la opción cuando `Date.now() >= endsAt`.

6. `round:result`
   - Emite: varios formatos (ejemplos abajo). Indica resultado de la ronda (resuelto por jugador, incorrecta, timeout, nobody pressed).

7. `game:update`
   - Emite: el `GameState` completo (ver esquema). Usar para sincronizar UI.

8. `game:ended` / `game:finished`
   - Emite: estado final / scores / winner.

Payloads y tipos (resumen)
- `readMs`, `pressWindowMs`, `answerTimeoutMs`: duración en ms (Number).
- `endsAt`: timestamp en ms (Number). Usarlo como fuente de verdad para countdowns.
- `GameState` (ver `types/frontend-socket.d.ts`) contiene `questionReadEndsAt`, `answerWindowStartedAt`, `answerWindowEndsAt` opcionales.

Ejemplos JSON

`round:showQuestion`:
```
{
  "roundSequence": 12,
  "questionText": "¿Cuál es la capital de Francia?",
  "readMs": 10000
}
```

`round:openButton`:
```
{
  "roundSequence": 12,
  "pressWindowMs": 10000
}
```

`round:answerRequest` (emitido al ganador):
```
{
  "roundSequence": 12,
  "options": ["Londres","París","Berlín","Madrid"],
  "answerTimeoutMs": 30000,
  "endsAt": 1700000000000
}
```

`round:result` (ejemplo por timeout):
```
{
  "roundSequence": 12,
  "playerId": null,
  "correct": false,
  "message": "⏰ Se acabó el tiempo para responder",
  "scores": {"user1": 200, "user2": 150 }
}
```

Reglas de validación en frontend
- Siempre calcular remaining = endsAt - Date.now() y usar Math.max(0, remaining) para la UI.
- Deshabilitar botones si remaining <= 0; aun así, enviar la acción y aceptar respuesta del servidor (el servidor es quien decide). Manejar 408 de servidor.
- Al recibir `round:result`, limpiar cualquier timeout/cuenta regresiva y no permitir nuevas acciones para esa ronda.
- No confiar en setTimeout exacto del navegador para decisiones críticas: sincronizar contra `endsAt`.

Pruebas recomendadas (manuales y automáticas)
- Verificar que `round:openButton` se emite luego de `round:showQuestion` tras el `readMs` esperado.
- Simular respuesta rápida y respuesta lenta para comprobar bonificaciones (usar `answerTimeoutMs`/`endsAt`).
- Simular race: enviar `round:answer` a ~0ms antes del `endsAt` y confirmar que solo se procesa una `round:result`.

Notas operativas
- Si el frontend necesita reproducir timers mientras está desconectado temporalmente, reconectar y solicitar estado (`game:update`/unirse a sala) para recargar `GameState` y calcular `remaining`.
- Si el backend cambia constantes (ej. `ANSWER_TIMEOUT_MS`) el frontend debe tomar dinámicamente los valores enviados por eventos (`answerTimeoutMs`, `pressWindowMs`) en vez de hardcodearlos.

Contactos
- Si el frontend detecta comportamientos inconsistentes (p.ej. `endsAt` en el pasado al recibir `round:answerRequest`), reportar con payloads completos y timestamps del cliente.

----
Archivo de tipos sugerido: `types/frontend-socket.d.ts` (exportado desde este repo) para facilitar el tipado en frontend.
