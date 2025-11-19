# ARQUITECTURAS DE SOFTWARE 2025-2
## Escuela Colombiana de Ingeniería "Julio Garavito"
## Proyecto Sprint 2 - TrivIAndo Backend

**Fecha de inicio:** Noviembre 19 de 2025  
**Fecha de finalización:** Diciembre 3 de 2025

---

## 1. Gestión del Sprint y Cumplimiento de SCRUM

### Propuesta de Implementación

Para cumplir con las prácticas fundamentales de SCRUM utilizando Azure DevOps:

#### 1.1 Sprint Planning
- **Actividad:** Seleccionar Historias de Usuario del Product Backlog al Sprint Backlog
- **Herramienta:** Azure DevOps Boards
- **Proceso:**
  1. Revisar el Product Backlog priorizado
  2. Estimar cada Historia de Usuario utilizando Planning Poker o Fibonacci
  3. Definir la capacidad del equipo para el Sprint
  4. Seleccionar Historias de Usuario que el equipo se compromete a completar
  5. Descomponer cada Historia en tareas técnicas

#### 1.2 Definición de Criterios de Aceptación
Cada Historia de Usuario debe incluir:
- **Dado** (contexto inicial)
- **Cuando** (acción ejecutada)
- **Entonces** (resultado esperado)
- Criterios específicos relacionados con procesamiento en tiempo real y concurrencia

#### 1.3 Registro Continuo del Avance
- **Daily Scrum:** Actualización diaria del estado de las tareas en Azure DevOps
- **Burndown Chart:** Actualización automática mediante Azure DevOps
- **Métricas a Monitorear:**
  - Velocity del equipo
  - Story Points completados vs. planeados
  - Impedimentos identificados

#### 1.4 Definition of Done (DoD)
Para que una Historia de Usuario esté en estado DONE debe cumplir:
- [ ] Código desarrollado y revisado (Code Review)
- [ ] Tests unitarios implementados con cobertura mínima del 40%
- [ ] Tests de integración para endpoints REST y eventos Socket.IO
- [ ] Documentación API actualizada (OpenAPI/Swagger)
- [ ] Análisis estático de código ejecutado (SonarQube/SonarCloud)
- [ ] Pipeline de CI/CD ejecutado exitosamente
- [ ] Criterios de aceptación validados
- [ ] Despliegue en ambiente de prueba realizado

---

## 2. Atributo de Calidad: Disponibilidad (Escalabilidad + Tolerancia a Fallos)

### 2.1 Escenario de Calidad

**Escenario QA-1: Escalabilidad Horizontal del Backend**

| **Atributo** | **Detalle** |
|--------------|-------------|
| **Fuente** | Usuarios concurrentes jugando trivias en múltiples salas |
| **Estímulo** | Incremento de carga de 100 a 1000 usuarios simultáneos |
| **Artefacto** | Backend (API REST + Socket.IO) |
| **Entorno** | Operación normal en producción |
| **Respuesta** | El sistema escala horizontalmente agregando nuevas instancias del backend |
| **Medida de Respuesta** | - El tiempo de respuesta de API se mantiene < 200ms (p95)<br>- La latencia de eventos Socket.IO se mantiene < 100ms<br>- No hay pérdida de mensajes entre instancias<br>- El sistema soporta hasta 1000 usuarios concurrentes sin degradación |

### 2.2 Arquitectura Propuesta

#### 2.2.1 Componentes Distribuidos

```
┌─────────────┐
│   Clients   │
│  (Frontend) │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Load Balancer      │
│  (NGINX / Azure LB) │
└──────┬──────────────┘
       │
       ├────────────┬────────────┐
       ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Backend  │ │ Backend  │ │ Backend  │
│Instance 1│ │Instance 2│ │Instance N│
│(Node.js) │ │(Node.js) │ │(Node.js) │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │
     └────────────┴────────────┘
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ MongoDB │  │  Redis  │  │ Redis   │
│(Primary)│  │  Pub/Sub│  │ Adapter │
└─────────┘  └─────────┘  └─────────┘
```

#### 2.2.2 Restricciones Tecnológicas

1. **Balanceador de Carga (Obligatorio):**
   - **Opción 1:** NGINX configurado como reverse proxy y load balancer
   - **Opción 2:** Azure Load Balancer (si se mantiene despliegue en Azure)
   - **Configuración:** Algoritmo round-robin o least-connections
   - **Health Checks:** Endpoint `/health` en cada instancia del backend

2. **Redis Adapter para Socket.IO:**
   - Ya implementado en el código actual: `@socket.io/redis-adapter`
   - Permite comunicación entre múltiples instancias del backend
   - Sincroniza eventos Socket.IO mediante Pub/Sub de Redis

3. **Gestión de Timers Distribuidos:**
   - **Problema actual:** Los timers de juego están en memoria local (ver `game.service.ts`)
   - **Solución propuesta:** Implementar uno de los siguientes enfoques:
     - **Opción A:** Usar BullMQ con Redis para jobs programados
     - **Opción B:** Implementar un servicio coordinador dedicado para timers
     - **Opción C:** Usar Redis TTL + keyspace notifications para eventos temporales

#### 2.2.3 Despliegue NO Monolítico

**Propuesta de Despliegue Distribuido:**

| **Componente** | **Ubicación/Infraestructura** | **Instancias** |
|----------------|-------------------------------|----------------|
| Frontend | Azure Static Web Apps / CDN | N/A (estático) |
| Load Balancer | Azure Load Balancer / VM con NGINX | 1 (con HA opcional) |
| Backend API | Azure App Service / VMs / Containers | 2-3 instancias mínimo |
| MongoDB | Azure Cosmos DB / MongoDB Atlas | Cluster replicado |
| Redis | Azure Cache for Redis | Cluster (master-replica) |

### 2.3 Plan de Implementación

#### Fase 1: Preparación del Backend para Escalabilidad
- [ ] Refactorizar `game.service.ts` para usar timers distribuidos con BullMQ
- [ ] Configurar Redis Pub/Sub para coordinación entre instancias
- [ ] Implementar endpoint `/health` para health checks
- [ ] Remover dependencias de estado en memoria compartida

#### Fase 2: Configuración del Balanceador de Carga
- [ ] Configurar NGINX como reverse proxy con load balancing
- [ ] Definir reglas de distribución de tráfico
- [ ] Configurar health checks periódicos
- [ ] Implementar sticky sessions si es necesario para Socket.IO

#### Fase 3: Despliegue Distribuido
- [ ] Desplegar MongoDB en cluster replicado (mínimo 1 primary + 2 secondary)
- [ ] Desplegar Redis en configuración master-replica
- [ ] Desplegar múltiples instancias del backend (mínimo 2)
- [ ] Configurar variables de entorno para cada componente

#### Fase 4: Pruebas de Escalabilidad
- [ ] Ejecutar pruebas de carga con herramientas como Artillery o k6
- [ ] Validar distribución de carga entre instancias
- [ ] Verificar sincronización de Socket.IO entre instancias
- [ ] Medir latencia y throughput bajo carga

---

## 3. Atributo de Calidad: Seguridad

### 3.1 Escenarios de Calidad de Seguridad

#### Escenario QA-2: Autenticación y Autorización

| **Atributo** | **Detalle** |
|--------------|-------------|
| **Fuente** | Usuario no autenticado o con token inválido |
| **Estímulo** | Intento de acceso a endpoints protegidos o conexión a Socket.IO |
| **Artefacto** | Middleware de autenticación (`authMiddleware`, `socketAuthMiddleware`) |
| **Entorno** | Operación normal |
| **Respuesta** | El sistema rechaza la solicitud y retorna error 401 Unauthorized |
| **Medida de Respuesta** | - 100% de endpoints protegidos requieren JWT válido<br>- Tokens expirados son rechazados<br>- Logs de intentos de acceso no autorizados |

**Táctica aplicada:** Resist Attacks - Authenticate Users (JWT tokens)

#### Escenario QA-3: Protección contra Inyección de Código

| **Atributo** | **Detalle** |
|--------------|-------------|
| **Fuente** | Usuario malicioso |
| **Estímulo** | Envío de payloads con código malicioso (NoSQL injection, XSS) en campos de entrada |
| **Artefacto** | Validación de entrada con Zod, sanitización de datos |
| **Entorno** | Operación bajo ataque |
| **Respuesta** | El sistema valida y sanitiza todas las entradas, rechazando payloads maliciosos |
| **Medida de Respuesta** | - Validación con Zod en todos los endpoints<br>- Sanitización de inputs antes de queries a MongoDB<br>- Rate limiting implementado para prevenir ataques de fuerza bruta |

**Táctica aplicada:** Resist Attacks - Validate Inputs

#### Escenario QA-4: Trazabilidad y Detección de Ataques

| **Atributo** | **Detalle** |
|--------------|-------------|
| **Fuente** | Sistema de monitoreo |
| **Estímulo** | Múltiples intentos fallidos de autenticación o patrones anómalos |
| **Artefacto** | Sistema de logging y auditoría |
| **Entorno** | Operación bajo posible ataque |
| **Respuesta** | El sistema registra todos los eventos de seguridad y genera alertas |
| **Medida de Respuesta** | - Logs detallados de autenticación (exitosa y fallida)<br>- Logging de operaciones sensibles (CRUD de salas, resultados)<br>- Correlación de eventos por sessionId/userId<br>- Alertas automáticas en caso de patrones sospechosos |

**Táctica aplicada:** Detect Attacks - Audit / Log Actions

### 3.2 Actualización de la Arquitectura

**Mecanismos de Seguridad a Incorporar:**

```
┌──────────────────────────────────────┐
│          API Gateway / LB            │
│  ┌────────────────────────────────┐  │
│  │  Rate Limiting (Express)       │  │
│  │  Helmet.js (Security Headers)  │  │
│  └────────────────────────────────┘  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│         Backend Instances            │
│  ┌────────────────────────────────┐  │
│  │  JWT Authentication Middleware │  │
│  │  Input Validation (Zod)        │  │
│  │  Sanitization (mongoose)       │  │
│  │  CORS Configuration            │  │
│  │  Logging & Auditing            │  │
│  └────────────────────────────────┘  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│         Database Layer               │
│  ┌────────────────────────────────┐  │
│  │  MongoDB with TLS/SSL          │  │
│  │  Connection String Encryption  │  │
│  │  Database User Permissions     │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 3.3 Plan de Implementación de Seguridad

#### Fase 1: Autenticación y Autorización
- [ ] Revisar y fortalecer implementación actual de JWT
- [ ] Implementar refresh tokens para mayor seguridad
- [ ] Agregar roles y permisos (admin, player, guest)
- [ ] Implementar autorización basada en roles en endpoints críticos

#### Fase 2: Protección contra Ataques
- [ ] Implementar rate limiting con `express-rate-limit`
- [ ] Agregar Helmet.js para headers de seguridad HTTP
- [ ] Validar exhaustivamente con Zod todos los inputs
- [ ] Implementar sanitización adicional para prevenir NoSQL injection
- [ ] Configurar CORS estricto para producción

#### Fase 3: Trazabilidad y Auditoría
- [ ] Implementar sistema de logging estructurado (Winston o Pino)
- [ ] Crear logs de auditoría para operaciones críticas:
  - Autenticación (login, logout, token refresh)
  - Creación/modificación de salas
  - Generación de preguntas con IA
  - Acceso a resultados
- [ ] Implementar correlación de requests con requestId
- [ ] Configurar alertas en Azure Monitor o servicio equivalente

#### Fase 4: Secretos y Configuración
- [ ] Migrar todas las credenciales a Azure Key Vault
- [ ] Implementar rotación automática de JWT_SECRET
- [ ] Configurar TLS/SSL para todas las conexiones:
  - MongoDB con TLS
  - Redis con TLS
  - HTTPS en Load Balancer

---

## 4. Atributo de Calidad: Mantenibilidad

### 4.1 Escenario de Calidad

**Escenario QA-5: Análisis Estático Continuo**

| **Atributo** | **Detalle** |
|--------------|-------------|
| **Fuente** | Desarrollador del equipo |
| **Estímulo** | Commit/Push de código al repositorio |
| **Artefacto** | Pipeline de CI/CD (GitHub Actions) |
| **Entorno** | Desarrollo y pre-producción |
| **Respuesta** | El pipeline ejecuta análisis estático de código con SonarCloud |
| **Medida de Respuesta** | - Análisis completo en < 5 minutos<br>- Reporte de code smells, bugs y vulnerabilidades<br>- Cobertura de código calculada<br>- Quality Gate Pass/Fail basado en umbrales configurados |

### 4.2 Integración de SonarCloud en el Pipeline

#### 4.2.1 Configuración de SonarCloud

**Archivo de configuración: `sonar-project.properties`**
```properties
sonar.projectKey=Pokesaurios_triviando-backend
sonar.organization=pokesaurios
sonar.sources=src
sonar.tests=tests
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.test.inclusions=tests/**/*.test.ts
sonar.coverage.exclusions=**/*.test.ts,**/*.spec.ts,**/node_modules/**
sonar.typescript.tsconfigPath=tsconfig.json
```

#### 4.2.2 Actualización del Pipeline de GitHub Actions

**Modificaciones a `.github/workflows/test_triviando-backend.yml`:**

```yaml
name: Build, Test, Quality Analysis, and Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Necesario para SonarCloud

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22.x'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

      - name: Run tests with coverage
        run: npm test

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: node-app
          path: .
```

#### 4.2.3 Quality Gates Configurados

**Umbrales mínimos en SonarCloud:**
- **Coverage:** ≥ 40% (objetivo para bonificación)
- **Bugs:** 0 nuevos bugs
- **Vulnerabilities:** 0 nuevas vulnerabilidades
- **Code Smells:** ≤ 10 nuevos code smells
- **Security Hotspots:** 100% revisados
- **Duplications:** < 3%
- **Maintainability Rating:** A o B

### 4.3 Plan de Implementación

#### Fase 1: Configuración Inicial
- [ ] Crear cuenta en SonarCloud.io
- [ ] Vincular repositorio de GitHub con SonarCloud
- [ ] Generar `SONAR_TOKEN` y agregarlo a GitHub Secrets
- [ ] Crear archivo `sonar-project.properties`

#### Fase 2: Integración en Pipeline
- [ ] Actualizar workflow de GitHub Actions
- [ ] Configurar análisis de cobertura de código con Jest
- [ ] Ejecutar primer análisis y revisar baseline

#### Fase 3: Remediación
- [ ] Revisar y resolver issues críticos reportados por SonarCloud
- [ ] Mejorar cobertura de tests hasta alcanzar mínimo 40%
- [ ] Refactorizar código con code smells identificados
- [ ] Documentar código complejo identificado

#### Fase 4: Monitoreo Continuo
- [ ] Configurar Quality Gate como obligatorio para merge
- [ ] Establecer revisión de métricas en cada Sprint Review
- [ ] Documentar guías de codificación basadas en análisis

### 4.4 Bonificación: Objetivo A/Verde + 40% Cobertura

**Plan para alcanzar la bonificación:**

1. **Incrementar Cobertura de Tests:**
   - Agregar tests unitarios para todos los servicios
   - Agregar tests de integración para todos los controllers
   - Agregar tests para middleware y utils
   - Agregar tests para Socket.IO handlers

2. **Alcanzar Rating "A" en Mantenibilidad:**
   - Refactorizar funciones con complejidad ciclomática alta
   - Eliminar código duplicado
   - Aplicar principios SOLID
   - Documentar funciones públicas

3. **Métricas Objetivo:**
   - **Coverage Backend:** ≥ 40%
   - **Reliability:** A
   - **Security:** A
   - **Maintainability:** A

---

## 5. Atributo de Calidad: Rendimiento / Latencia (Real-Time)

### 5.1 Escenarios de Calidad

#### Escenario QA-6: Latencia en Procesamiento Real-Time

| **Atributo** | **Detalle** |
|--------------|-------------|
| **Fuente** | Múltiples jugadores respondiendo simultáneamente a una pregunta |
| **Estímulo** | 50 usuarios en una sala responden a una pregunta al mismo tiempo |
| **Artefacto** | Socket.IO server, game.service.ts |
| **Entorno** | Operación normal con carga media |
| **Respuesta** | El sistema procesa las respuestas y emite actualización de estado |
| **Medida de Respuesta** | - Latencia máxima de procesamiento: 50ms (p95)<br>- Latencia de comunicación Socket.IO: < 100ms<br>- Sincronización de estado entre clientes: < 150ms<br>- Sin pérdida de mensajes |

#### Escenario QA-7: Concurrencia de Usuarios

| **Atributo** | **Detalle** |
|--------------|-------------|
| **Fuente** | Crecimiento de usuarios concurrentes |
| **Estímulo** | Sistema alcanza 500 usuarios simultáneos en múltiples salas |
| **Artefacto** | Backend completo (API + WebSockets) |
| **Entorno** | Operación bajo carga alta |
| **Respuesta** | El sistema mantiene rendimiento estable |
| **Medida de Respuesta** | - Tiempo de respuesta API REST: < 200ms (p95)<br>- Latencia Socket.IO: < 100ms (p95)<br>- CPU utilization: < 70%<br>- Memory utilization: < 80%<br>- Sin degradación perceptible para usuarios |

### 5.2 Actualización de Arquitectura para Rendimiento

#### 5.2.1 Componentes y Tácticas

```
┌─────────────────────────────────────────────┐
│         Performance Optimization            │
├─────────────────────────────────────────────┤
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  Caching Layer (Redis)             │    │
│  │  - Room state cache                │    │
│  │  - User sessions cache             │    │
│  │  - Question cache (AI generated)   │    │
│  │  TTL: 5-60 minutes                 │    │
│  └────────────────────────────────────┘    │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  Asynchronous Processing           │    │
│  │  - BullMQ for background jobs      │    │
│  │  - Event-driven architecture       │    │
│  │  - Non-blocking I/O                │    │
│  └────────────────────────────────────┘    │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  Connection Pooling                │    │
│  │  - MongoDB connection pool         │    │
│  │  - Redis connection pool           │    │
│  └────────────────────────────────────┘    │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  WebSocket Optimization            │    │
│  │  - Binary protocol (MessagePack)   │    │
│  │  - Compression enabled             │    │
│  │  - Room-based namespaces           │    │
│  └────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

#### 5.2.2 Optimizaciones Específicas

1. **Caching Strategy:**
   - Cache de estado de salas en Redis (TTL: 30 min)
   - Cache de preguntas generadas por IA (TTL: 60 min)
   - Cache de resultados de usuarios (TTL: 10 min)
   - Invalidación proactiva al actualizar datos

2. **Database Query Optimization:**
   - Índices en MongoDB para queries frecuentes
   - Projection para limitar campos retornados
   - Agregación pipeline optimizada
   - Evitar N+1 queries

3. **Socket.IO Optimization:**
   - Usar rooms para broadcasting eficiente
   - Implementar namespaces por tipo de evento
   - Habilitar compresión de mensajes
   - Considerar MessagePack para payload binario

4. **Asynchronous Processing:**
   - Generación de preguntas con IA en background
   - Cálculo de estadísticas en jobs programados
   - Notificaciones push desacopladas

### 5.3 Pruebas Técnicas de Rendimiento

#### 5.3.1 Herramientas Propuestas

1. **Artillery** - Load testing para HTTP y WebSockets
2. **k6** - Modern load testing tool
3. **Socket.IO Load Tester** - Específico para WebSockets

#### 5.3.2 Escenario de Prueba: Stress Test

**Objetivo:** Validar que el sistema soporta 500 usuarios concurrentes con latencia < 100ms

**Configuración de Artillery:**

```yaml
# artillery-stress-test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up load"
    - duration: 180
      arrivalRate: 100
      name: "Sustained high load"
  socketio:
    transports: ["websocket"]

scenarios:
  - name: "Join room and play game"
    engine: socketio
    flow:
      - emit:
          channel: "joinRoom"
          data:
            roomId: "{{ roomId }}"
            userId: "{{ $uuid }}"
      - think: 2
      - emit:
          channel: "answerQuestion"
          data:
            questionId: "{{ questionId }}"
            answer: "{{ answer }}"
      - think: 5
```

**Métricas a Capturar:**
- Requests per second (RPS)
- Response time (min, max, median, p95, p99)
- Socket.IO connection time
- Message latency
- Error rate
- Concurrent connections

#### 5.3.3 Escenario de Prueba: Load Test de API REST

**Configuración de k6:**

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 200 },  // Spike to 200
    { duration: '2m', target: 200 },  // Stay at 200
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% de requests < 200ms
    http_req_failed: ['rate<0.01'],   // Error rate < 1%
  },
};

export default function () {
  // Test crear sala
  let createRoomRes = http.post('http://localhost:3000/api/rooms', {
    topic: 'Historia',
    questionQuantity: 5,
    maxPlayers: 10,
  });
  
  check(createRoomRes, {
    'status is 201': (r) => r.status === 201,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);

  // Test obtener salas
  let getRoomsRes = http.get('http://localhost:3000/api/rooms');
  
  check(getRoomsRes, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  });

  sleep(2);
}
```

### 5.4 Plan de Implementación

#### Fase 1: Optimizaciones de Código
- [ ] Implementar caching de Redis para room state
- [ ] Optimizar queries de MongoDB con índices
- [ ] Refactorizar game.service para procesamiento asíncrono
- [ ] Implementar connection pooling adecuado

#### Fase 2: Configuración de Pruebas
- [ ] Instalar Artillery y k6
- [ ] Crear scripts de pruebas de carga
- [ ] Configurar ambiente de staging para pruebas
- [ ] Establecer baseline de rendimiento

#### Fase 3: Ejecución de Pruebas
- [ ] Ejecutar load test con carga gradual (50, 100, 200, 500 usuarios)
- [ ] Ejecutar stress test para identificar límites del sistema
- [ ] Medir latencia de Socket.IO bajo carga
- [ ] Documentar resultados y métricas

#### Fase 4: Optimización Basada en Resultados
- [ ] Identificar cuellos de botella
- [ ] Aplicar optimizaciones específicas
- [ ] Re-ejecutar pruebas para validar mejoras
- [ ] Documentar configuración óptima para producción

---

## 6. Resumen de Entregables

### 6.1 Documentación
- [x] Este documento (Sprint2.md) con propuestas detalladas
- [ ] Diagramas de arquitectura actualizados (C4 Model o UML)
- [ ] Escenarios de calidad documentados en Azure DevOps
- [ ] Guía de despliegue distribuido
- [ ] Documentación de pruebas de rendimiento

### 6.2 Código y Configuración
- [ ] Refactorización de game.service.ts con timers distribuidos
- [ ] Configuración de NGINX o Azure Load Balancer
- [ ] Dockerfile y docker-compose para despliegue local
- [ ] Configuración de SonarCloud (sonar-project.properties)
- [ ] Scripts de pruebas de carga (Artillery/k6)
- [ ] Middleware de seguridad mejorado (rate limiting, Helmet)
- [ ] Sistema de logging y auditoría

### 6.3 Pipeline y CI/CD
- [ ] Pipeline actualizado con análisis de SonarCloud
- [ ] Quality Gate configurado
- [ ] Despliegue multi-instancia en Azure
- [ ] Health checks configurados

### 6.4 Pruebas
- [ ] Tests unitarios con cobertura ≥ 40%
- [ ] Tests de integración para endpoints críticos
- [ ] Tests de carga documentados y ejecutados
- [ ] Validación de escenarios de calidad

---

## 7. Consideraciones Técnicas Adicionales

### 7.1 Timers Distribuidos - Solución Recomendada

**Problema:** Los timers en `game.service.ts` están en memoria local y no funcionan en múltiples instancias.

**Solución con BullMQ:**

```typescript
// game.service.ts refactorizado
import { Queue, Worker } from 'bullmq';

const gameTimerQueue = new Queue('game-timers', {
  connection: redisConnection
});

// Programar evento de siguiente pregunta
async function scheduleNextQuestion(roomId: string, delayMs: number) {
  await gameTimerQueue.add(
    'next-question',
    { roomId },
    { delay: delayMs, removeOnComplete: true }
  );
}

// Worker que procesa eventos de timer
const worker = new Worker('game-timers', async (job) => {
  const { roomId } = job.data;
  
  if (job.name === 'next-question') {
    await handleNextQuestion(roomId);
  }
}, { connection: redisConnection });
```

**Ventajas:**
- Timers persistidos en Redis
- Funciona en múltiples instancias
- Reintentos automáticos
- Dashboard de monitoreo (Bull Board)

### 7.2 Consideraciones de Escalabilidad

**Límites conocidos:**
- **MongoDB:** Escala bien hasta ~10K writes/sec en replica set
- **Redis:** > 100K ops/sec en configuración optimizada
- **Socket.IO:** ~10K conexiones concurrentes por instancia (Node.js)
- **Node.js:** Single-threaded, escalar horizontalmente con múltiples instancias

**Recomendaciones:**
- Usar PM2 o Cluster module para aprovechar múltiples cores
- Implementar sticky sessions si el frontend usa polling
- Monitorear uso de memoria (EventEmitter leaks)
- Implementar circuit breakers para servicios externos (IA)

### 7.3 Monitoreo y Observabilidad

**Métricas clave a monitorear:**
- **Aplicación:**
  - Request rate (req/s)
  - Response time (p50, p95, p99)
  - Error rate (%)
  - Active WebSocket connections
  - Event loop lag

- **Infraestructura:**
  - CPU utilization (%)
  - Memory utilization (%)
  - Network I/O
  - Disk I/O (MongoDB)

**Herramientas sugeridas:**
- Azure Application Insights
- Prometheus + Grafana
- New Relic / DataDog (comercial)
- ELK Stack para logs centralizados

---

## 8. Cronograma Sugerido (2 semanas)

### Semana 1 (Nov 19 - Nov 26)
- **Día 1-2:** Sprint Planning, estimación, definición de DoD
- **Día 3-4:** Implementar seguridad (rate limiting, logging, Helmet)
- **Día 5-6:** Refactorizar timers distribuidos con BullMQ
- **Día 7:** Configurar SonarCloud e integración en pipeline

### Semana 2 (Nov 27 - Dic 3)
- **Día 8-9:** Configurar despliegue multi-instancia y load balancer
- **Día 10-11:** Incrementar cobertura de tests a 40%+
- **Día 12:** Ejecutar pruebas de carga y optimizar
- **Día 13:** Documentar escenarios de calidad y arquitectura
- **Día 14:** Sprint Review, demostración, retrospectiva

---

## 9. Definiciones de Historias de Usuario Sugeridas

### HU-1: Implementar Escalabilidad Horizontal
**Como** arquitecto del sistema  
**Quiero** que el backend soporte múltiples instancias detrás de un balanceador de carga  
**Para** garantizar alta disponibilidad y escalabilidad

**Criterios de Aceptación:**
- [ ] Múltiples instancias del backend se pueden ejecutar simultáneamente
- [ ] Un load balancer distribuye el tráfico entre instancias
- [ ] Socket.IO funciona correctamente con el Redis adapter
- [ ] Los timers de juego están distribuidos (BullMQ/Redis)
- [ ] El sistema pasa prueba de carga con 500 usuarios concurrentes

**Estimación:** 13 Story Points

---

### HU-2: Fortalecer Seguridad del Sistema
**Como** responsable de seguridad  
**Quiero** implementar mecanismos de protección contra ataques comunes  
**Para** proteger los datos de usuarios y garantizar la integridad del sistema

**Criterios de Aceptación:**
- [ ] Rate limiting implementado en endpoints críticos
- [ ] Headers de seguridad HTTP configurados (Helmet.js)
- [ ] Logging de auditoría para operaciones sensibles
- [ ] Validación exhaustiva de inputs con Zod
- [ ] Tests de seguridad ejecutados y documentados

**Estimación:** 8 Story Points

---

### HU-3: Integrar Análisis Estático de Código
**Como** líder de equipo  
**Quiero** que el código pase por análisis estático en cada commit  
**Para** mantener alta calidad de código y detectar issues tempranamente

**Criterios de Aceptación:**
- [ ] SonarCloud integrado en pipeline de GitHub Actions
- [ ] Quality Gate configurado con umbrales definidos
- [ ] Cobertura de código ≥ 40%
- [ ] Rating de mantenibilidad "A" o "B"
- [ ] Pipeline bloquea merge si Quality Gate falla

**Estimación:** 5 Story Points

---

### HU-4: Optimizar Rendimiento Real-Time
**Como** usuario jugador  
**Quiero** que el sistema responda en tiempo real sin lag perceptible  
**Para** tener una experiencia de juego fluida

**Criterios de Aceptación:**
- [ ] Latencia de Socket.IO < 100ms (p95)
- [ ] Tiempo de respuesta API < 200ms (p95)
- [ ] Caching implementado para consultas frecuentes
- [ ] Índices de MongoDB optimizados
- [ ] Pruebas de carga ejecutadas y documentadas

**Estimación:** 8 Story Points

---

## 10. Riesgos y Mitigación

| **Riesgo** | **Probabilidad** | **Impacto** | **Mitigación** |
|------------|------------------|-------------|----------------|
| Complejidad de timers distribuidos | Alta | Alto | Dedicar tiempo suficiente, usar BullMQ (bien documentado) |
| No alcanzar 40% de cobertura | Media | Medio | Priorizar tests desde inicio del sprint |
| Problemas de configuración de Load Balancer | Media | Alto | Usar docker-compose para validar localmente primero |
| Degradación de rendimiento en producción | Baja | Alto | Ejecutar pruebas de carga en staging antes de producción |
| Bloqueos por Quality Gate de SonarCloud | Media | Medio | Ejecutar análisis local frecuentemente durante desarrollo |

---

## Conclusión

Este documento propone una estrategia completa para cumplir con todos los requerimientos del Sprint 2, enfocándose en:

1. **Disponibilidad:** Arquitectura distribuida con load balancer y timers centralizados
2. **Seguridad:** Tres escenarios implementados con tácticas específicas
3. **Mantenibilidad:** Integración de SonarCloud con objetivo de bonificación
4. **Rendimiento:** Optimizaciones y pruebas de carga documentadas

Todas las propuestas son concretas, implementables y alineadas con la arquitectura actual del proyecto TrivIAndo.

**Próximo paso:** Validar estas propuestas con el profesor, crear las Historias de Usuario en Azure DevOps, y comenzar la implementación siguiendo las fases definidas.
