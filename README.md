```markdown
# triviando-backend
```

## Development

See project files for scripts and configuration. This repository contains the backend for the TrivIAndo game server.

## Notes

### Timers and deployment note

The game server uses in-memory timers (see `src/services/game.service.ts` -> `timersMap` and `scheduleTimer`) to coordinate question flow, open/close windows and fallback timeouts. These timers are stored in the process memory and are suitable for single-instance deployments (one running server process).

If you plan to run multiple instances (horizontal scaling), these in-memory timers will not be shared across instances and can cause inconsistent behavior (duplicate timers, missed events). Options to address this when scaling:

- Move timers to a centralized store or scheduler (Redis key TTL + worker, BullMQ, Agenda, or a dedicated job worker).
- Use Redis-based pub/sub or streams to coordinate time-based events across instances.
- Keep a single dedicated "leader" instance responsible for timers (requires leader election).

Add a short comment in the code or infrastructure docs if you intend to scale so future maintainers are aware of this limitation.
# triviando-backend