# 🎯 Guía Rápida - Demo de Autorización para el Jurado

## ⚡ Inicio Rápido (5 minutos)

### 1. Preparación
```bash
# Terminal 1: Iniciar servidor
npm run dev

# Verificar que MongoDB está corriendo
```

### 2. Ejecutar Demostración Automatizada
```bash
# Terminal 2: Demo guiada completa
npm run demo:auth
```

Este comando ejecuta un asistente interactivo que te guía por todos los pasos.

---

## 🔧 Comandos Individuales

Si prefieres ejecutar cada parte manualmente:

### Auditoría de Endpoints (1 min)
```bash
npm run audit:endpoints
```
**Muestra:** 100% de endpoints protegidos ✅

### Generar Tokens de Prueba (1 min)
```bash
npm run generate:token all
```
**Genera:** Tokens válidos, expirados e inválidos

### Monitor de Seguridad (continuo)
```bash
npm run monitor:security
```
**Dashboard en tiempo real** de intentos de acceso

### Tests Automatizados (2 min)
```bash
npm test -- authorization.http.test.ts
npm test -- socketAuthMiddleware.test.ts
```

---

## 📝 Demo con Requests HTTP

### Archivo: `demo/authorization-demo.http`

1. **Abrir en VS Code** (necesita extensión REST Client)
2. **Ejecutar en orden:**
   - PASO 1: Registrar usuario → `201 Created`
   - PASO 2: Login → `200 OK` + copiar token
   - Escenario A: Sin token → `401 Unauthorized`
   - Escenario B: Token inválido → `401 Unauthorized`
   - Escenario C: Token expirado → `401 Unauthorized`
   - Escenario D: Token válido → `200 OK` ✅
   - Escenario E: Sin permisos → `403 Forbidden`

---

## 📊 Lo Que El Jurado Verá

### 1. Auditoría (Evidencia de 100% protección)
```
Total de endpoints REST:      8
Endpoints protegidos:         6 ✓
Endpoints sin protección:     2 (solo login/register)
Tasa de protección:           100.00%
Socket.IO protegido:          ✓ SÍ
```

### 2. Monitor en Tiempo Real
```
Total intentos:              42
✅ Exitosos:                 15
❌ Fallidos:                 27
🚫 No autorizados (401):     22
🛑 Prohibidos (403):         5

Razones de Fallo:
  • Token no proporcionado: 10
  • Token inválido: 8
  • Token expirado: 4
  • Sin permisos (403): 5
```

### 3. Respuestas HTTP
- Sin token: `401 {"message": "Token not provided or invalid"}`
- Token expirado: `401 {"message": "Token invalid or expired"}`
- Sin permisos: `403 {"message": "You are not authorized..."}`
- Token válido: `200 OK` + datos

### 4. Tests Pasando
```
✓ GET /rooms/:code returns 403 when user not authorized
✓ Socket auth rejects connection without token
✓ All failed attempts are logged
```

---

## ✅ Checklist para la Presentación

### Antes de Empezar
- [ ] Servidor corriendo (`npm run dev`)
- [ ] MongoDB conectado
- [ ] `.env` configurado con JWT_SECRET
- [ ] Terminal preparada (PowerShell)

### Durante la Demo (15-20 min)
- [ ] **Paso 1:** Mostrar auditoría → 100% protección
- [ ] **Paso 2:** Generar tokens de prueba
- [ ] **Paso 3:** Abrir monitor en terminal separada
- [ ] **Paso 4:** Ejecutar requests HTTP mostrando:
  - Sin token → 401
  - Token inválido → 401
  - Token válido → 200
  - Sin permisos → 403
- [ ] **Paso 5:** Mostrar monitor capturando intentos
- [ ] **Paso 6:** Ejecutar tests automatizados
- [ ] **Paso 7:** Resumir medidas de respuesta

### Evidencia para Documentar
- [ ] Screenshot de auditoría (100%)
- [ ] Screenshot de monitor con métricas
- [ ] Respuestas HTTP 401/403/200
- [ ] Tests pasando ✅
- [ ] Archivos JSON generados en `audit/`

---

## 🗣️ Puntos Clave para Mencionar

1. **"100% de endpoints protegidos"** 
   → Demostrado con `audit-endpoints.ts`

2. **"Validación automática de expiración"**
   → JWT verifica exp (3h configurado)

3. **"Todos los fallos se registran"**
   → Logger.warn() + monitor-security-logs.ts

4. **"401 vs 403 correctamente implementado"**
   → 401 = no autenticado
   → 403 = autenticado pero sin permisos

5. **"Socket.IO también protegido"**
   → socketAuthMiddleware para WebSocket

---

## 🆘 Solución Rápida de Problemas

### Servidor no inicia
```bash
# Verificar MongoDB
# Revisar .env (JWT_SECRET)
```

### No se capturan logs
```bash
# Ejecutar algunos requests primero
# El monitor creará el archivo logs/
```

### Token no funciona
```bash
# Regenerar token:
npm run generate:token valid

# Copiar y pegar completo con "Bearer "
```

### REST Client no funciona
```bash
# Alternativa: usar cURL o Postman
# O ejecutar demo automatizada: npm run demo:auth
```

---

## 📦 Archivos de Salida

Después de la demo, tendrás:
```
audit/
├── security-audit-report.json     ← Endpoints protegidos
├── security-logs-report.json      ← Intentos registrados
└── unprotected_routes.json        ← Rutas públicas

coverage/
└── lcov-report/index.html         ← Cobertura de tests
```

---

## 🎬 Script de 5 Minutos para el Jurado

```bash
# 1. Mostrar auditoría (30s)
npm run audit:endpoints

# 2. Generar tokens (30s)
npm run generate:token all

# 3. Abrir monitor en terminal 2 (dejar corriendo)
npm run monitor:security

# 4. En VS Code: abrir demo/authorization-demo.http
#    Ejecutar requests mostrando 401, 403, 200 (2 min)

# 5. Volver al monitor, mostrar métricas capturadas (30s)

# 6. Ejecutar tests (1 min)
npm test -- authorization.http.test.ts

# 7. Resumir: ✅ 100% protegido, ✅ logs registrados (30s)
```

**Tiempo total:** ~5-7 minutos + preguntas

---

## 🏆 Resultado Esperado

✅ **Escenario cumplido:**
- Validación JWT en todos los endpoints
- Rechazo 401 sin token
- Rechazo 403 sin permisos  
- Registro de intentos fallidos
- 100% de endpoints críticos protegidos

**Documentación completa en:** `demo/AUTHORIZATION_DEMO_README.md`
