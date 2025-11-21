# Atributos de Calidad - TrivIAndo Backend

Este documento describe los atributos de calidad a reforzar en este sprint, incluyendo requerimientos no funcionales, escenarios de calidad siguiendo el formato SEI/ATAM, y estrategias de implementación.

## Contenido

- [1. Formato de Escenarios](#1-formato-de-escenarios)
- [2. Disponibilidad (Escalabilidad + Tolerancia a Fallos)](#2-disponibilidad-escalabilidad--tolerancia-a-fallos)
- [3. Seguridad](#3-seguridad)
- [4. Mantenibilidad](#4-mantenibilidad)
- [5. Rendimiento / Latencia (Real-Time)](#5-rendimiento--latencia-real-time)
- [6. Arquitectura y Tácticas](#6-arquitectura-y-tácticas)

---

## 1. Formato de Escenarios

Todos los escenarios de calidad en este documento siguen el formato SEI/ATAM:

- **Fuente del estímulo**: Quién o qué genera el estímulo
- **Estímulo**: Qué ocurre en el sistema
- **Artefacto afectado**: Componente, servicio, canal, API, etc.
- **Entorno**: Estado del sistema cuando ocurre el estímulo
- **Respuesta**: Cómo debe reaccionar el sistema
- **Medida de respuesta**: Límites cuantitativos esperados

---

## 2. Disponibilidad (Escalabilidad + Tolerancia a Fallos)

### 2.1 Requerimientos

- ✅ Arquitectura que permita escalar horizontalmente el Backend
- ✅ Uso explícito de balanceador de carga como restricción tecnológica
- ✅ Prototipo funcional que demuestre escalabilidad
- ✅ Distribución física de componentes: Backend, Frontend, Base de Datos, Servicios en tiempo real
- ⚠️ **Restricción**: La arquitectura NO debe ser monolítica en un solo servidor

### 2.2 Escenario de Calidad: Escalabilidad Horizontal

#### Escenario #1: Incremento de Carga de Usuarios Concurrentes

| Elemento | Descripción |
|----------|-------------|
| **Fuente del estímulo** | Miles de usuarios intentando conectarse simultáneamente durante horarios pico (ej: evento promocional, lanzamiento de nueva trivia) |
| **Estímulo** | Incremento abrupto de 100 a 5,000 usuarios concurrentes en menos de 5 minutos |
| **Artefacto afectado** | Backend API (Express), WebSocket Server (Socket.IO), Redis Pub/Sub, MongoDB |
| **Entorno** | Sistema en operación normal con 100-500 usuarios conectados. Auto-scaling habilitado en Azure App Service o equivalente |
| **Respuesta** | El sistema debe: <br>1. Detectar el incremento de carga mediante métricas de CPU/memoria <br>2. Provisionar automáticamente nuevas instancias del backend (escalar de 2 a 6 instancias) <br>3. El balanceador de carga distribuye conexiones entrantes entre todas las instancias activas <br>4. Redis adapter sincroniza eventos Socket.IO entre instancias <br>5. Todas las instancias mantienen acceso compartido a MongoDB |
| **Medida de respuesta** | - Tiempo de respuesta promedio de API REST: ≤ 200ms (p95) <br>- Latencia de eventos WebSocket: ≤ 100ms (p95) <br>- Disponibilidad del sistema: ≥ 99.5% <br>- Tiempo de aprovisionamiento de nuevas instancias: ≤ 2 minutos <br>- Sin pérdida de sesiones activas durante el escalado <br>- Tasa de error: ≤ 0.1% |

#### Arquitectura Propuesta para Disponibilidad

```
┌─────────────────┐
│   Usuarios      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  Load Balancer              │
│  (Azure Load Balancer /     │
│   Application Gateway)      │
└────────┬────────────────────┘
         │
    ┌────┴────┬────────────┬──────────┐
    ▼         ▼            ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│Backend  │ │Backend  │ │Backend  │ │Backend  │
│Instance │ │Instance │ │Instance │ │Instance │
│   #1    │ │   #2    │ │   #3    │ │   #N    │
└────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │           │           │           │
     └───────────┴───────────┴───────────┘
                 │
         ┌───────┴───────┐
         │               │
         ▼               ▼
    ┌──────────┐    ┌──────────┐
    │  Redis   │    │ MongoDB  │
    │ (Pub/Sub)│    │ (Shared) │
    └──────────┘    └──────────┘
```

### 2.3 Tácticas de Implementación

1. **Escalado Horizontal**:
   - Configurar Azure App Service con auto-scaling basado en CPU (>70%) y memoria (>80%)
   - Mínimo 2 instancias, máximo 10 instancias
   - Socket.IO Redis Adapter (`@socket.io/redis-adapter`) ya integrado

2. **Balanceador de Carga**:
   - Azure Application Gateway con sticky sessions basadas en cookies
   - Health checks cada 30 segundos para detectar instancias no saludables
   - Timeout de 30 segundos para conexiones idle

3. **Estado Compartido**:
   - Redis para sincronización de eventos Socket.IO entre instancias
   - MongoDB como base de datos compartida entre todas las instancias
   - Session storage en Redis (opcional) para mantener sesiones de usuario

4. **Tolerancia a Fallos**:
   - Health check endpoint: `GET /health` retorna status del servidor
   - Reconexión automática de WebSocket con exponential backoff
   - Circuit breaker para llamadas a servicios externos (MongoDB, Redis)

---

## 3. Seguridad

### 3.1 Requerimientos

- ✅ Especificar 3 escenarios de calidad de seguridad
- ✅ Escenarios revisados y aprobados
- ✅ Arquitectura actualizada con mecanismos de seguridad explícitos
- ✅ Implementación de escenarios aprobados
- ✅ Basado en tácticas de Software Architecture in Practice (Bass, Clements & Kazman)

### 3.2 Escenario de Calidad #1: Autenticación y Autorización

| Elemento | Descripción |
|----------|-------------|
| **Fuente del estímulo** | Usuario no autenticado o con token expirado intentando acceder a recursos protegidos |
| **Estímulo** | Solicitud HTTP a endpoints protegidos sin token JWT válido, o intento de acceso a recursos de otros usuarios |
| **Artefacto afectado** | Middleware de autenticación (`auth.middleware.ts`), controladores REST, handlers de Socket.IO |
| **Entorno** | Sistema en operación normal, recibiendo múltiples requests de usuarios legítimos y potenciales atacantes |
| **Respuesta** | El sistema debe: <br>1. Validar el token JWT en cada request a endpoints protegidos <br>2. Verificar que el token no haya expirado (tiempo de vida: 24h) <br>3. Verificar permisos del usuario para el recurso solicitado <br>4. Rechazar requests sin autenticación con HTTP 401 Unauthorized <br>5. Rechazar requests sin autorización con HTTP 403 Forbidden <br>6. Registrar intentos fallidos en logs para análisis de seguridad |
| **Medida de respuesta** | - 100% de endpoints protegidos requieren token válido <br>- Tiempo de validación de token: ≤ 10ms <br>- Tasa de falsos positivos: 0% <br>- Tasa de falsos negativos: 0% <br>- Todos los intentos fallidos registrados en logs |

#### Tácticas Implementadas:
- **Identificar actores**: JWT con payload que incluye `userId`, `email`, `role`
- **Autenticar actores**: Middleware `authenticateToken` valida firma JWT con secret key
- **Autorizar actores**: Verificación de permisos basada en rol y ownership de recursos
- **Limitar acceso**: Rate limiting por IP (100 requests/minuto)

### 3.3 Escenario de Calidad #2: Protección contra Ataques de Inyección

| Elemento | Descripción |
|----------|-------------|
| **Fuente del estímulo** | Atacante externo con conocimiento de vulnerabilidades comunes (OWASP Top 10) |
| **Estímulo** | Envío de payloads maliciosos en requests HTTP: <br>- Inyección NoSQL en parámetros de búsqueda <br>- XSS en campos de texto (nombres de sala, mensajes) <br>- Inyección de comandos en campos de input |
| **Artefacto afectado** | Controladores REST, modelos Mongoose, validadores de input, endpoints de Socket.IO |
| **Entorno** | Sistema expuesto a internet, recibiendo requests de fuentes desconocidas |
| **Respuesta** | El sistema debe: <br>1. Validar y sanitizar todos los inputs usando Zod schemas <br>2. Usar queries parametrizadas de Mongoose (previene NoSQL injection) <br>3. Escapar caracteres especiales en outputs para prevenir XSS <br>4. Rechazar payloads que no cumplan schemas con HTTP 400 Bad Request <br>5. Registrar intentos de inyección en logs de seguridad <br>6. Bloquear IPs con múltiples intentos maliciosos (>5 en 1 minuto) |
| **Medida de respuesta** | - 100% de inputs validados con Zod schemas antes de procesamiento <br>- 0 vulnerabilidades de inyección detectadas en análisis estático (SonarCloud) <br>- Tasa de bloqueo de ataques conocidos: ≥ 99% <br>- Tiempo de respuesta ante ataque: ≤ 50ms (rechazo inmediato) |

#### Tácticas Implementadas:
- **Validar inputs**: Zod schemas en todos los endpoints (`z.object()`, `z.string()`, etc.)
- **Sanitizar datos**: Mongoose esquemas con validación estricta de tipos
- **Codificar outputs**: Escape automático en respuestas JSON (Express default)
- **Detectar intrusiones**: Logs estructurados de requests sospechosos
- **Limitar exposición**: CORS configurado con whitelist de dominios permitidos

### 3.4 Escenario de Calidad #3: Protección de Datos Sensibles

| Elemento | Descripción |
|----------|-------------|
| **Fuente del estímulo** | Usuario registrándose o autenticándose, atacante con acceso a base de datos o logs |
| **Estímulo** | Almacenamiento, transmisión y acceso a datos sensibles: <br>- Contraseñas de usuarios <br>- Tokens de sesión (JWT) <br>- Información personal (emails, nombres) <br>- Secrets de configuración (API keys, DB credentials) |
| **Artefacto afectado** | Servicio de autenticación, base de datos MongoDB, logs del sistema, variables de entorno |
| **Entorno** | Sistema en operación con datos de miles de usuarios almacenados |
| **Respuesta** | El sistema debe: <br>1. Hashear contraseñas con bcrypt (12 rounds) antes de almacenar <br>2. Nunca almacenar contraseñas en texto plano <br>3. Transmitir datos sensibles solo por HTTPS (TLS 1.2+) <br>4. Almacenar secrets en variables de entorno, nunca en código fuente <br>5. No loggear contraseñas, tokens completos ni API keys <br>6. Enmascarar datos sensibles en logs (ej: email → e***@example.com) <br>7. Usar JWT con expiración corta (24h) y secret key robusta (256 bits) |
| **Medida de respuesta** | - 100% de contraseñas hasheadas con bcrypt <br>- 0 secrets en código fuente (verificado con git-secrets) <br>- 100% de comunicaciones por HTTPS en producción <br>- 0 contraseñas o tokens completos en logs <br>- Tiempo de hash de contraseña: ≤ 500ms <br>- 0 vulnerabilidades de exposición de datos en análisis de seguridad |

#### Tácticas Implementadas:
- **Encriptar datos**: bcrypt para passwords, HTTPS para transmisión
- **Proteger confidencialidad**: JWT con expiración, tokens no loggeados
- **Restringir acceso**: Variables de entorno para secrets, .env en .gitignore
- **Detectar modificaciones**: Logs de cambios en perfiles de usuario
- **Recuperarse de compromisos**: Procedimiento de rotación de JWT_SECRET documentado

### 3.5 Arquitectura de Seguridad

```
┌──────────────────────────────────────────────┐
│              HTTPS / TLS 1.2+                │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │  Load Balancer      │
         │  + WAF (Firewall)   │
         └──────────┬──────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
    ┌─────────┐          ┌─────────┐
    │ Backend │          │ Backend │
    │    +    │          │    +    │
    │  Auth   │          │  Auth   │
    │Middleware│         │Middleware│
    └────┬────┘          └────┬────┘
         │                     │
         └──────────┬──────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
    ┌──────────┐         ┌──────────┐
    │  Redis   │         │ MongoDB  │
    │(Sessions)│         │(Encrypted)│
    └──────────┘         └──────────┘
```

**Capas de Seguridad**:
1. **Perímetro**: HTTPS obligatorio, WAF para filtrar tráfico malicioso
2. **Autenticación**: JWT con middleware en todas las rutas protegidas
3. **Autorización**: Verificación de roles y ownership de recursos
4. **Validación**: Zod schemas en todos los inputs
5. **Almacenamiento**: Bcrypt para passwords, encriptación en tránsito y reposo
6. **Monitoreo**: Logs estructurados de eventos de seguridad

---

## 4. Mantenibilidad

### 4.1 Requerimientos

- ✅ Definir escenario de calidad de mantenibilidad con Inspección Continua
- ✅ Integrar SonarQube/SonarCloud en pipeline de CI
- ✅ Investigar integración de herramienta CI con Sonar
- 🎁 **Bono**: Alcanzar estado "A / Verde" y ≥40% cobertura de pruebas unitarias (+0.5 puntos)

### 4.2 Escenario de Calidad: Inspección Continua de Código

| Elemento | Descripción |
|----------|-------------|
| **Fuente del estímulo** | Desarrollador realiza commit y push de código nuevo o modificado a la rama principal |
| **Estímulo** | Pull request o merge a rama `main` con cambios en código TypeScript del backend |
| **Artefacto afectado** | Todo el código fuente en `src/`, archivos de configuración, tests en `tests/` |
| **Entorno** | Pipeline de CI/CD activo en GitHub Actions, SonarCloud configurado y conectado al repositorio |
| **Respuesta** | El sistema debe: <br>1. Ejecutar análisis estático de código con SonarCloud automáticamente <br>2. Calcular métricas de calidad: complejidad ciclomática, duplicación, code smells <br>3. Ejecutar tests unitarios y calcular cobertura de código <br>4. Generar reporte con Quality Gate status <br>5. Fallar el build si Quality Gate no pasa (rating < B o cobertura < 40%) <br>6. Publicar resultados en PR como comentario automático <br>7. Prevenir merge si análisis falla |
| **Medida de respuesta** | - Análisis ejecutado en 100% de los commits a `main` <br>- Tiempo de análisis: ≤ 5 minutos <br>- Quality Gate: rating ≥ A en Maintainability, Reliability, Security <br>- Cobertura de código: ≥ 40% (objetivo: ≥ 80%) <br>- Deuda técnica: ≤ 5% del tiempo de desarrollo <br>- Code smells: ≤ 10 por 1000 líneas de código <br>- Duplicación: ≤ 3% <br>- Complejidad ciclomática promedio: ≤ 10 |

### 4.3 Configuración de SonarCloud

#### Pasos de Integración:

1. **Configurar proyecto en SonarCloud**:
   - Registrarse en [sonarcloud.io](https://sonarcloud.io)
   - Importar repositorio `Pokesaurios/triviando-backend`
   - Generar `SONAR_TOKEN` y agregarlo a GitHub Secrets

2. **Agregar archivo de configuración** (`sonar-project.properties`):
   ```properties
   sonar.projectKey=Pokesaurios_triviando-backend
   sonar.organization=pokesaurios
   sonar.sources=src
   sonar.tests=tests
   sonar.test.inclusions=**/*.test.ts,**/*.spec.ts
   sonar.javascript.lcov.reportPaths=coverage/lcov.info
   sonar.coverage.exclusions=**/*.test.ts,**/*.spec.ts,**/dist/**
   sonar.typescript.tsconfigPath=tsconfig.json
   ```

3. **Actualizar workflow de CI** (`.github/workflows/test_triviando-backend.yml`):
   - Agregar step de SonarCloud Scan después de ejecutar tests
   - Configurar Quality Gate check

4. **Configurar Quality Gate personalizado**:
   - Maintainability Rating: ≥ A
   - Reliability Rating: ≥ A
   - Security Rating: ≥ A
   - Coverage: ≥ 40% (objetivo: 80%)
   - Duplicated Lines: ≤ 3%
   - Code Smells: ≤ 50 (ajustar según tamaño del proyecto)

### 4.4 Tácticas de Mantenibilidad

1. **Modularización**:
   - Estructura de carpetas clara: `controllers/`, `services/`, `models/`, `middleware/`
   - Single Responsibility Principle en cada módulo

2. **Pruebas Automatizadas**:
   - Tests unitarios con Jest
   - Tests de integración con supertest
   - Objetivo: 80% de cobertura

3. **Documentación**:
   - OpenAPI/Swagger para documentar API REST
   - JSDoc comments en funciones públicas
   - README actualizado con instrucciones claras

4. **Linting y Formateo**:
   - ESLint configurado con reglas estrictas
   - TypeScript para tipado estático
   - Pre-commit hooks para validar código (opcional)

5. **Gestión de Deuda Técnica**:
   - Revisión semanal de SonarCloud dashboard
   - Priorización de code smells y vulnerabilidades en sprints
   - Refactorización continua de código legacy

---

## 5. Rendimiento / Latencia (Real-Time)

### 5.1 Requerimientos

- ✅ Especificar al menos 2 escenarios de rendimiento/latencia en tiempo real
- ✅ Escenarios alineados con procesamiento real-time y concurrencia
- ✅ Actualizar arquitectura para mostrar componentes de soporte (caching, colas, etc.)
- ✅ Implementar prueba técnica que demuestre cumplimiento (Stress Test / Load Test)

### 5.2 Escenario de Calidad #1: Latencia de Eventos en Tiempo Real

| Elemento | Descripción |
|----------|-------------|
| **Fuente del estímulo** | Jugadores en una sala de trivia activa enviando respuestas simultáneamente |
| **Estímulo** | Múltiples usuarios (10-100) en la misma sala envían respuestas a una pregunta al mismo tiempo (dentro de una ventana de 5 segundos) |
| **Artefacto afectado** | Socket.IO server, Redis Pub/Sub adapter, `game.service.ts`, handlers de eventos WebSocket |
| **Entorno** | Juego en curso, temporizador de pregunta activo (30 segundos), 50 salas concurrentes con 20 jugadores promedio cada una |
| **Respuesta** | El sistema debe: <br>1. Recibir evento `submitAnswer` de cada jugador <br>2. Validar respuesta contra pregunta activa <br>3. Calcular puntos basados en corrección y tiempo de respuesta <br>4. Persistir respuesta en MongoDB de forma asíncrona <br>5. Emitir evento `answerSubmitted` de vuelta al jugador (confirmación) <br>6. Broadcast evento `playerAnswered` a todos en la sala (sin revelar respuesta) <br>7. Al finalizar el temporizador, broadcast `questionResults` con puntuaciones actualizadas |
| **Medida de respuesta** | - Latencia end-to-end (cliente → servidor → broadcast): ≤ 100ms (p95), ≤ 50ms (p50) <br>- Tiempo de procesamiento de respuesta en servidor: ≤ 30ms <br>- Tiempo de persistencia en MongoDB (async): ≤ 200ms <br>- Jitter (variación de latencia): ≤ 20ms <br>- Throughput: ≥ 1000 respuestas/segundo por instancia <br>- Pérdida de mensajes: 0% <br>- Orden de mensajes garantizado dentro de una sala |

### 5.3 Escenario de Calidad #2: Concurrencia de Usuarios Simultáneos

| Elemento | Descripción |
|----------|-------------|
| **Fuente del estímulo** | Múltiples grupos de jugadores iniciando y jugando trivias simultáneamente |
| **Estímulo** | 1000 usuarios concurrentes distribuidos en 100 salas activas, cada sala con juegos en progreso (preguntas cada 30 segundos) |
| **Artefacto afectado** | Socket.IO connections, timers en `game.service.ts`, pool de conexiones MongoDB, Redis pub/sub, backend instances |
| **Entorno** | Sistema en operación con carga moderada (500 usuarios), horario pico con incremento gradual a 1000 usuarios en 10 minutos |
| **Respuesta** | El sistema debe: <br>1. Mantener conexiones WebSocket estables para todos los usuarios <br>2. Ejecutar timers de juego independientes para cada sala sin interferencia <br>3. Sincronizar estado de juego entre instancias via Redis <br>4. Escalar horizontalmente agregando instancias según demanda <br>5. Balancear conexiones nuevas entre instancias disponibles <br>6. Mantener latencia baja incluso bajo alta concurrencia <br>7. Prevenir race conditions en actualizaciones de estado |
| **Medida de respuesta** | - Usuarios concurrentes soportados: ≥ 1000 (objetivo: 5000) <br>- Salas concurrentes: ≥ 100 (objetivo: 500) <br>- Tasa de desconexiones inesperadas: ≤ 0.5% <br>- Latencia promedio bajo carga: ≤ 150ms (p95) <br>- CPU utilization por instancia: ≤ 70% <br>- Memoria utilization por instancia: ≤ 80% <br>- Tiempo de reconexión automática: ≤ 3 segundos <br>- Degradación de rendimiento: ≤ 10% al pasar de 500 a 1000 usuarios |

### 5.4 Arquitectura de Rendimiento

```
┌─────────────────────────────────────────────────┐
│            Usuarios Concurrentes                │
│         (1000-5000 conexiones WS)               │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Load Balancer       │
         │ (Sticky Sessions +    │
         │  WebSocket Support)   │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌─────────┐            ┌─────────┐
    │Backend 1│            │Backend 2│
    │Socket.IO│            │Socket.IO│
    │+ Timers │            │+ Timers │
    └────┬────┘            └────┬────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌──────────┐           ┌──────────┐
    │  Redis   │           │ MongoDB  │
    │          │           │          │
    │- Pub/Sub │           │- Indexed │
    │- Adapter │           │- Pooled  │
    │- Cache   │           │- Sharded │
    └──────────┘           └──────────┘
         ▲                       ▲
         │                       │
         └───── Performance ─────┘
                 Optimizations:
                 - Redis caching
                 - MongoDB indexes
                 - Connection pooling
                 - Async processing
```

### 5.5 Tácticas de Rendimiento

1. **Gestión de Recursos**:
   - Pool de conexiones MongoDB (tamaño: 10-50 por instancia)
   - Redis connection pooling
   - Lazy loading de datos no críticos

2. **Concurrencia**:
   - Event loop de Node.js para I/O asíncrono
   - Worker threads para operaciones CPU-intensivas (si aplica)
   - Redis pub/sub para comunicación inter-proceso

3. **Caching**:
   - Redis cache para preguntas frecuentes
   - TTL de 5 minutos para preguntas de trivia
   - Cache de resultados de queries complejas

4. **Optimización de Base de Datos**:
   - Índices en campos frecuentemente consultados:
     - `rooms`: `roomCode`, `createdBy`, `status`
     - `users`: `email`, `username`
     - `gameResults`: `roomId`, `userId`, `createdAt`
   - Queries con projection (seleccionar solo campos necesarios)
   - Bulk operations para inserción de múltiples documentos

5. **WebSocket Optimizations**:
   - Binary protocol para payloads grandes (opcional)
   - Compression habilitado (gzip)
   - Heartbeat/ping-pong para detectar conexiones muertas (30s interval)

### 5.6 Pruebas de Rendimiento

#### Herramientas:
- **Artillery**: Para load testing de WebSockets y HTTP
- **k6**: Para stress testing y generación de métricas
- **Socket.IO Client**: Para scripts de testing personalizados

#### Escenarios de Testing:

1. **Load Test - Conexiones Concurrentes**:
   ```bash
   # Simular 1000 usuarios conectándose gradualmente
   artillery run --target ws://localhost:4000 load-test.yml
   ```
   - Duración: 10 minutos
   - Ramp-up: 100 usuarios/minuto hasta 1000
   - Validar: latencia, tasa de errores, CPU/memoria

2. **Stress Test - Pico de Tráfico**:
   ```bash
   # Simular spike de 5000 usuarios en 2 minutos
   k6 run --vus 5000 --duration 5m stress-test.js
   ```
   - Identificar punto de ruptura del sistema
   - Medir degradación gradual vs colapso abrupto
   - Validar recuperación después del pico

3. **Endurance Test - Estabilidad a Largo Plazo**:
   - 500 usuarios concurrentes durante 2 horas
   - Detectar memory leaks o degradación progresiva
   - Validar estabilidad de timers y reconexiones

4. **Spike Test - Manejo de Eventos Simultáneos**:
   - 100 jugadores en una sala responden simultáneamente
   - Medir latencia p50, p95, p99
   - Validar orden de procesamiento y ausencia de race conditions

#### Métricas a Monitorear:
- **Latencia**: p50, p95, p99 de tiempo de respuesta
- **Throughput**: Requests/segundo, eventos WebSocket/segundo
- **Errores**: Tasa de error, tipos de errores (timeout, connection refused, etc.)
- **Recursos**: CPU, memoria, network I/O, disk I/O
- **Conexiones**: Active connections, connection rate, disconnection rate

---

## 6. Arquitectura y Tácticas

### 6.1 Vista de Componentes Distribuidos

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│                  (React + Socket.IO Client)                 │
│              Desplegado en: Azure Static Web Apps           │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS + WSS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                            │
│            Azure Application Gateway / Load Balancer        │
│              - Sticky Sessions (cookie-based)               │
│              - Health Checks (30s interval)                 │
│              - TLS Termination                              │
│              - WAF (Web Application Firewall)               │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
┌──────────────────────┐          ┌──────────────────────┐
│   BACKEND INSTANCE 1 │          │   BACKEND INSTANCE 2 │
│  Azure App Service   │          │  Azure App Service   │
│                      │          │                      │
│  - Express REST API  │          │  - Express REST API  │
│  - Socket.IO Server  │          │  - Socket.IO Server  │
│  - Game Service      │          │  - Game Service      │
│  - Auth Middleware   │          │  - Auth Middleware   │
└──────────┬───────────┘          └──────────┬───────────┘
           │                                  │
           └──────────────┬───────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
┌──────────────────────┐        ┌──────────────────────┐
│   REDIS CACHE        │        │   MONGODB CLUSTER    │
│  Azure Cache for     │        │  Azure Cosmos DB     │
│      Redis           │        │  (MongoDB API)       │
│                      │        │                      │
│  - Pub/Sub Adapter   │        │  - Users Collection  │
│  - Session Store     │        │  - Rooms Collection  │
│  - Game State Cache  │        │  - Results Collection│
│  - Rate Limiting     │        │  - Replicated        │
└──────────────────────┘        └──────────────────────┘
```

### 6.2 Restricciones Arquitectónicas

1. **NO monolítico**: Componentes distribuidos físicamente en diferentes servicios de Azure
2. **Balanceador obligatorio**: Azure Application Gateway para distribución de carga
3. **Escalabilidad horizontal**: Auto-scaling de 2 a 10 instancias del backend
4. **Estado compartido**: Redis y MongoDB compartidos entre todas las instancias
5. **Servicios en tiempo real**: Socket.IO con Redis adapter para sincronización

### 6.3 Decisiones de Diseño

| Decisión | Justificación | Trade-offs |
|----------|---------------|------------|
| Socket.IO con Redis Adapter | Sincronización de eventos entre múltiples instancias del backend | Mayor complejidad operacional, dependencia de Redis |
| JWT stateless | Escalabilidad horizontal sin necesidad de session store centralizado | No se pueden revocar tokens antes de expiración (mitigado con TTL corto) |
| MongoDB compartido | Consistencia de datos entre instancias, modelo de datos flexible | Potencial cuello de botella, requiere índices optimizados |
| Timers en memoria | Baja latencia para eventos de juego en tiempo real | Complicaciones al escalar (requiere coordinación entre instancias) |
| Auto-scaling basado en CPU | Respuesta automática a picos de carga | Costo variable, puede ser lento en picos muy abruptos |

### 6.4 Roadmap de Implementación

#### Sprint Actual (Semana 1-2):

1. **Disponibilidad**:
   - ✅ Configurar auto-scaling en Azure App Service
   - ✅ Implementar health check endpoint
   - ✅ Validar Redis adapter para Socket.IO
   - ✅ Configurar sticky sessions en load balancer

2. **Seguridad**:
   - ✅ Auditar middleware de autenticación
   - ✅ Agregar validación Zod en todos los endpoints pendientes
   - ✅ Configurar CORS restrictivo
   - ✅ Implementar rate limiting con Redis

3. **Mantenibilidad**:
   - ✅ Integrar SonarCloud en CI pipeline
   - ✅ Aumentar cobertura de tests a ≥40%
   - ✅ Crear Quality Gate personalizado
   - ✅ Documentar proceso de análisis de código

4. **Rendimiento**:
   - ✅ Crear índices optimizados en MongoDB
   - ✅ Implementar caching de preguntas en Redis
   - ✅ Configurar connection pooling
   - ✅ Ejecutar load tests iniciales con Artillery

#### Próximos Sprints (Semana 3-4):

1. **Optimizaciones de Rendimiento**:
   - Implementar circuit breaker para servicios externos
   - Optimizar queries MongoDB con projection
   - Agregar monitoring con Application Insights
   - Implementar graceful shutdown

2. **Mejoras de Seguridad**:
   - Agregar refresh tokens para JWT
   - Implementar rate limiting por usuario
   - Configurar alertas de seguridad
   - Realizar penetration testing

3. **Mantenibilidad Avanzada**:
   - Incrementar cobertura a ≥80%
   - Refactorizar código con alta complejidad ciclomática
   - Agregar pre-commit hooks
   - Crear guía de contribución

4. **Pruebas de Carga**:
   - Stress test con 5000 usuarios concurrentes
   - Endurance test de 4 horas
   - Chaos engineering (simular fallos de Redis/MongoDB)
   - Tuning de performance basado en resultados

---

## 7. Métricas y Monitoreo

### 7.1 KPIs del Sistema

| Métrica | Objetivo | Crítico | Herramienta |
|---------|----------|---------|-------------|
| Disponibilidad | ≥99.5% | ≥99.0% | Azure Monitor |
| Latencia API (p95) | ≤200ms | ≤500ms | Application Insights |
| Latencia WebSocket (p95) | ≤100ms | ≤300ms | Custom metrics |
| Usuarios concurrentes | ≥1000 | ≥500 | Socket.IO admin UI |
| Tasa de error | ≤0.1% | ≤1% | Azure Monitor |
| Cobertura de tests | ≥40% | ≥30% | Jest + SonarCloud |
| Quality Gate | A | B | SonarCloud |
| Deuda técnica | ≤5% | ≤10% | SonarCloud |

### 7.2 Dashboards

1. **Operational Dashboard**:
   - Conexiones activas WebSocket
   - Requests por segundo (RPS)
   - Latencia p50/p95/p99
   - Tasa de error por endpoint
   - CPU y memoria por instancia

2. **Security Dashboard**:
   - Intentos de autenticación fallidos
   - Requests bloqueados por rate limiting
   - IPs sospechosas
   - Vulnerabilidades detectadas (SonarCloud)

3. **Quality Dashboard** (SonarCloud):
   - Maintainability rating
   - Cobertura de tests
   - Code smells y bugs
   - Deuda técnica
   - Duplicación de código

---

## 8. Conclusiones

Este documento define los atributos de calidad críticos para TrivIAndo Backend:

1. **Disponibilidad**: Arquitectura distribuida con auto-scaling y balanceador de carga, soportando hasta 5000 usuarios concurrentes con ≥99.5% uptime.

2. **Seguridad**: Implementación de autenticación JWT, validación de inputs, protección contra inyecciones y encriptación de datos sensibles.

3. **Mantenibilidad**: Integración de SonarCloud para análisis continuo de código, con objetivo de Quality Gate A y ≥40% cobertura de tests.

4. **Rendimiento**: Latencia ≤100ms (p95) para eventos en tiempo real, soporte de 1000+ usuarios concurrentes con degradación mínima.

Todos los escenarios siguen el formato SEI/ATAM con métricas cuantitativas claras y están alineados con las tácticas de Software Architecture in Practice.

---

## Referencias

- Bass, L., Clements, P., & Kazman, R. (2021). *Software Architecture in Practice* (4th ed.). Addison-Wesley.
- [SonarCloud Documentation](https://docs.sonarcloud.io/)
- [Socket.IO Scaling Documentation](https://socket.io/docs/v4/scaling/)
- [Azure App Service Auto-scaling](https://learn.microsoft.com/en-us/azure/app-service/manage-scale-up)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
