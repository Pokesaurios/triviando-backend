# 🛡️ Demostración de Escenario de Calidad: Autorización

## 📋 Resumen del Escenario

**Escenario de Calidad:** Autorización y Control de Acceso  
**Objetivo:** Demostrar al jurado que el sistema cumple con los requisitos de seguridad establecidos

### Estímulos del Escenario
- Usuario no autorizado intentando acceder a recursos protegidos
- Token JWT expirado (>3 horas)
- Intentos de acceso a recursos de otros usuarios
- Solicitudes sin token de autenticación

### Respuestas Esperadas
- ✅ 100% de endpoints protegidos requieren token válido
- ✅ Validación de expiración de tokens (3h)
- ✅ Rechazo con 401 Unauthorized para requests sin autenticación
- ✅ Rechazo con 403 Forbidden para requests sin autorización
- ✅ Registro de todos los intentos fallidos en logs

---

## 🎯 Preparación para la Demostración

### Requisitos Previos

1. **Servidor en ejecución**
   ```bash
   npm run dev
   ```

2. **Base de datos MongoDB activa**
   ```bash
   # Verificar conexión en los logs del servidor
   ```

3. **Variables de entorno configuradas**
   - `JWT_SECRET`: Secreto para firmar tokens
   - `JWT_EXPIRATION`: 3h (configurado)

---

## 📊 Parte 1: Auditoría de Endpoints Protegidos

### Ejecutar Auditoría Automática

```bash
npm run audit:endpoints
```

**Qué muestra:**
- Lista completa de todos los endpoints REST
- Estado de protección de cada endpoint
- Middlewares aplicados (authMiddleware, validación, etc.)
- Verificación de Socket.IO con `socketAuthMiddleware`
- **Métrica clave:** Tasa de protección al 100%

### Salida Esperada

```
╔═══════════════════════════════════════════════════════════╗
║     REPORTE DE AUDITORÍA DE SEGURIDAD - AUTORIZACIÓN     ║
╚═══════════════════════════════════════════════════════════╝

📊 RESUMEN EJECUTIVO:
─────────────────────────────────────────────────────────────
Total de endpoints REST:      8
Endpoints protegidos:         6 ✓
Endpoints sin protección:     2
Tasa de protección:           100.00%
Socket.IO protegido:          ✓ SÍ

✅ CUMPLIMIENTO: 100% de endpoints protegidos requeridos están seguros
```

**Archivos generados:**
- `audit/security-audit-report.json` - Reporte detallado en JSON

---

## 🧪 Parte 2: Demostración Práctica con Requests

### Opción A: VS Code REST Client (Recomendado)

1. **Instalar extensión** (si no está instalada):
   - REST Client by Huachao Mao

2. **Abrir archivo de demostración:**
   ```
   demo/authorization-demo.http
   ```

3. **Ejecutar requests en orden:**

#### Paso 1: Registrar usuario
Click en "Send Request" sobre el comentario `### PASO 1`
- Respuesta esperada: `201 Created`

#### Paso 2: Login y obtener token
Click en "Send Request" sobre el comentario `### PASO 2`
- Respuesta esperada: `200 OK` con token JWT
- **IMPORTANTE:** Copiar el `token` recibido y reemplazar `{{validToken}}` en el archivo

#### Escenario A: Sin token (401)
Ejecutar requests A1, A2, A3
- Todos deben retornar `401 Unauthorized`

#### Escenario B: Token malformado (401)
Ejecutar requests B1, B2, B3
- Todos deben retornar `401 Unauthorized`

#### Escenario C: Token expirado (401)
Para generar un token expirado:
```bash
# Opción 1: Usar jwt.io para crear un token con exp en el pasado
# Opción 2: Modificar temporalmente JWT_EXPIRATION a "1s" y esperar
```

#### Escenario D: Token válido (200)
Ejecutar requests D1, D2, D3 con el token obtenido
- Todos deben retornar `200 OK`

#### Escenario E: Acceso no autorizado (403)
1. Crear segundo usuario (E1)
2. Hacer login (E2) y copiar su token
3. Intentar acceder a sala del primer usuario (E3)
- Debe retornar `403 Forbidden`

### Opción B: Postman/Thunder Client

Importar los requests desde `demo/authorization-demo.http` o ejecutarlos manualmente siguiendo la misma secuencia.

### Opción C: cURL desde Terminal

```bash
# Sin token (401)
curl -X GET http://localhost:3000/api/v1/auth/me

# Con token válido (200)
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer [TU_TOKEN_AQUI]"

# Token malformado (401)
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: token_invalido"
```

---

## 📊 Parte 3: Monitor de Logs en Tiempo Real

### Ejecutar Monitor de Seguridad

**En una terminal separada**, mientras ejecutas los requests de prueba:

```bash
npm run monitor:security
```

**Qué muestra:**
- Dashboard actualizado cada 5 segundos
- Total de intentos de autenticación/autorización
- Intentos exitosos vs fallidos
- Clasificación de errores:
  - Token no proporcionado
  - Token inválido
  - Token expirado
  - Sin permisos (403)
- IPs únicas que intentaron acceso
- Últimos eventos de seguridad

### Salida Esperada Durante la Demo

```
╔═══════════════════════════════════════════════════════════╗
║         DASHBOARD DE SEGURIDAD - TIEMPO REAL              ║
╚═══════════════════════════════════════════════════════════╝

📊 MÉTRICAS DE AUTENTICACIÓN/AUTORIZACIÓN:
─────────────────────────────────────────────────────────────
Total intentos:              42
✅ Exitosos:                 15
❌ Fallidos:                 27
🚫 No autorizados (401):     22
🛑 Prohibidos (403):         5
🌐 IPs únicas:               2

📋 RAZONES DE FALLO:
─────────────────────────────────────────────────────────────
   • Token no proporcionado: 10
   • Token inválido: 8
   • Token expirado: 4
   • Sin permisos (403): 5

📝 ÚLTIMOS EVENTOS DE SEGURIDAD:
─────────────────────────────────────────────────────────────
🟡 [2025-12-04T10:30:15.234Z]
   Missing or malformed Authorization header...
   IP: 127.0.0.1
```

**Archivos generados:**
- `audit/security-logs-report.json` - Reporte detallado de intentos

---

## ✅ Parte 4: Pruebas Automatizadas

### Ejecutar Suite de Tests de Autorización

```bash
npm test -- authorization.http.test.ts
```

**Qué prueba:**
- Endpoint GET /rooms/:code rechaza usuarios no autorizados (403)
- Endpoint GET /game-results/:code rechaza usuarios no autorizados (403)
- Logs de intentos fallidos se generan correctamente

```bash
npm test -- socketAuthMiddleware.test.ts
```

**Qué prueba:**
- Socket.IO rechaza conexiones sin token
- Socket.IO rechaza tokens inválidos
- Socket.IO rechaza tokens expirados
- Socket.IO acepta tokens válidos

### Ver Cobertura de Tests

```bash
npm test
npm run check:coverage
```

---

## 🎬 Guión para Presentación al Jurado

### 1. Introducción (2 min)
**Hablar mientras se muestra:**
- "Vamos a demostrar el escenario de calidad de Autorización"
- "El sistema debe proteger todos los endpoints y rechazar accesos no autorizados"

### 2. Auditoría de Endpoints (3 min)
**Ejecutar:**
```bash
npm run audit:endpoints
```

**Explicar:**
- "Esta herramienta analiza todo el código de rutas"
- "Verifica que cada endpoint protegido tiene middleware de autenticación"
- **Señalar:** Tasa de protección al 100%
- **Mostrar:** Socket.IO también protegido

### 3. Iniciar Monitor de Logs (1 min)
**Ejecutar en terminal separada:**
```bash
npm run monitor:security
```

**Explicar:**
- "Este monitor captura intentos de acceso en tiempo real"
- "Clasifica automáticamente los tipos de errores"

### 4. Demostración de Requests (8 min)

**Abrir:** `demo/authorization-demo.http`

#### a) Crear usuario y login (2 min)
- Ejecutar PASO 1 y PASO 2
- Copiar token recibido

#### b) Intentos sin token (2 min)
- Ejecutar Escenario A (A1, A2, A3)
- **Mostrar en el monitor:** Logs de "Token no proporcionado"
- **Señalar:** Todos retornan 401

#### c) Token inválido (1 min)
- Ejecutar Escenario B (B1, B2)
- **Mostrar en el monitor:** Logs de "Token inválido"

#### d) Token válido (2 min)
- Reemplazar `{{validToken}}` con el token real
- Ejecutar Escenario D (D1, D2, D3)
- **Señalar:** Todos retornan 200 OK

#### e) Acceso no autorizado 403 (1 min)
- Crear segundo usuario (E1, E2)
- Intentar acceder a sala del primer usuario (E3)
- **Mostrar:** 403 Forbidden
- **Explicar:** "Usuario autenticado pero sin permisos sobre este recurso"

### 5. Revisión del Monitor (2 min)
**Volver a la terminal del monitor**

**Señalar:**
- Total de intentos registrados
- Clasificación de errores
- **Métrica clave:** "100% de intentos fallidos fueron registrados"

### 6. Tests Automatizados (2 min)
**Ejecutar:**
```bash
npm test -- authorization.http.test.ts
```

**Explicar:**
- "Tests automáticos verifican el comportamiento"
- "Se ejecutan en CI/CD para garantizar que no se rompa la seguridad"

### 7. Conclusión (1 min)
**Resumir medidas de respuesta:**
- ✅ Validación de token JWT en cada request
- ✅ Verificación de expiración (3h)
- ✅ Verificación de permisos del usuario
- ✅ Rechazo de requests sin autenticación (401)
- ✅ Rechazo de requests sin autorización (403)
- ✅ Registro de todos los intentos fallidos en logs
- ✅ **100% de endpoints protegidos**

---

## 📸 Evidencia para Documentación

### Capturas Recomendadas

1. **Salida de `npm run audit:endpoints`**
   - Muestra tasa de protección al 100%

2. **Dashboard del monitor en tiempo real**
   - Muestra métricas de intentos fallidos

3. **Requests en VS Code con respuestas**
   - 401 Unauthorized para intentos sin token
   - 403 Forbidden para accesos no permitidos
   - 200 OK para accesos autorizados

4. **Logs generados** (`audit/security-logs-report.json`)
   - Evidencia de registro de intentos

5. **Cobertura de tests**
   - Muestra tests de autorización pasando

### Archivos para Entregar

```
triviando-backend/
├── demo/
│   └── authorization-demo.http          # Casos de prueba ejecutables
├── scripts/
│   ├── audit-endpoints.ts               # Herramienta de auditoría
│   └── monitor-security-logs.ts         # Monitor de seguridad
├── audit/
│   ├── security-audit-report.json       # Reporte de endpoints
│   └── security-logs-report.json        # Reporte de logs
├── tests/
│   ├── authorization.http.test.ts       # Tests automatizados
│   └── socketAuthMiddleware.test.ts     # Tests de Socket.IO
└── demo/
    └── AUTHORIZATION_DEMO_README.md     # Este documento
```

---

## 🔧 Solución de Problemas

### El servidor no inicia
```bash
# Verificar MongoDB
# Verificar variables de entorno en .env
# Ver logs del servidor
```

### No se generan logs
```bash
# Verificar que la carpeta logs/ existe
# Ejecutar algunos requests para generar actividad
# El monitor creará el archivo si no existe
```

### Token no funciona
```bash
# Verificar que JWT_SECRET está configurado en .env
# Asegurarse de incluir "Bearer " en el header
# Verificar que el token no haya expirado
```

### Auditoría no detecta endpoints
```bash
# Verificar que src/routes/ contiene archivos .routes.ts
# Revisar que los endpoints usan el patrón router.METHOD()
```

---

## 📚 Referencias

### Middleware de Autenticación
- `src/middleware/auth.middleware.ts` - REST API
- `src/middleware/socketAuth.ts` - Socket.IO

### Tests Relacionados
- `tests/authorization.http.test.ts`
- `tests/socketAuthMiddleware.test.ts`
- `tests/middleware.test.ts`

### Documentación
- `docs/authorization.md` - Diseño del sistema de autorización

---

## ✨ Resumen de Medidas de Respuesta

| Medida | Implementación | Verificación |
|--------|---------------|--------------|
| Validar token JWT | `authMiddleware` | audit-endpoints.ts |
| Verificar expiración (3h) | jwt.verify() | Tests + demo.http |
| Verificar permisos | Controladores | authorization.http.test.ts |
| Rechazar sin auth (401) | authMiddleware | Demo Escenario A, B, C |
| Rechazar sin permisos (403) | Lógica de negocio | Demo Escenario E |
| Registrar intentos fallidos | logger.warn() | monitor-security-logs.ts |
| 100% endpoints protegidos | Middleware en rutas | audit-endpoints.ts |

---

**¡Éxito en la presentación! 🎉**
