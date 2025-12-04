# 🎯 Comandos Disponibles - Demo de Autorización

## 🚀 Comandos Principales

### Verificación Pre-Demo
```bash
npm run verify:demo
```
Verifica que todo esté listo para la presentación (archivos, scripts, configuración).

### Demo Automatizada Completa
```bash
npm run demo:auth
```
Ejecuta un asistente interactivo que guía paso a paso por toda la demostración.

---

## 🔧 Comandos Individuales

### Auditoría de Seguridad
```bash
npm run audit:endpoints
```
**Salida:**
- Lista de todos los endpoints REST y Socket.IO
- Estado de protección de cada endpoint
- Tasa de protección (objetivo: 100%)
- Archivo generado: `audit/security-audit-report.json`

**Duración:** ~10 segundos

---

### Monitor de Seguridad en Tiempo Real
```bash
npm run monitor:security
```
**Características:**
- Dashboard actualizado cada 5 segundos
- Métricas de intentos de autenticación
- Clasificación de errores (token inválido, expirado, etc.)
- IPs únicas que intentaron acceso
- Logs de eventos recientes

**Uso:** Dejar corriendo en terminal separada mientras se ejecutan requests

**Detener:** Ctrl+C (genera reporte final en `audit/security-logs-report.json`)

---

### Generador de Tokens JWT

#### Generar todos los tipos
```bash
npm run generate:token all
```

#### Generar token válido (3h)
```bash
npm run generate:token valid
```

#### Generar token expirado
```bash
npm run generate:token expired
```

#### Generar token con firma inválida
```bash
npm run generate:token invalid
```

#### Generar token que expirará pronto
```bash
npm run generate:token soon [userId] [segundos]
# Ejemplo: npm run generate:token soon user123 60
```

#### Inspeccionar un token
```bash
npm run generate:token inspect <TOKEN>
# Ejemplo: npm run generate:token inspect eyJhbGc...
```

**Uso:** Copiar los tokens generados para usar en `demo/authorization-demo.http`

---

## 🧪 Tests

### Tests de Autorización HTTP
```bash
npm test -- authorization.http.test.ts
```
Verifica que endpoints rechacen usuarios sin permisos (403).

### Tests de Socket.IO
```bash
npm test -- socketAuthMiddleware.test.ts
```
Verifica autenticación en conexiones WebSocket.

### Test Específico de Middleware
```bash
npm test -- middleware.test.ts
```
Pruebas unitarias del middleware de autenticación.

### Todos los Tests con Cobertura
```bash
npm test
```

### Verificar Cobertura
```bash
npm run check:coverage
```
Valida que la cobertura de código sea ≥80%.

---

## 🌐 Servidor

### Desarrollo con Hot Reload
```bash
npm run dev
```

### Build de Producción
```bash
npm run build
npm start
```

---

## 📊 Uso Recomendado Durante la Demostración

### Setup Inicial (antes de la presentación)
```bash
# 1. Verificar que todo está listo
npm run verify:demo

# 2. Iniciar servidor
npm run dev
```

### Opción A: Demo Automatizada (Recomendado)
```bash
# En una terminal
npm run demo:auth
```
Sigue el asistente interactivo.

### Opción B: Manual (Máximo Control)

**Terminal 1: Servidor**
```bash
npm run dev
```

**Terminal 2: Auditoría**
```bash
npm run audit:endpoints
```

**Terminal 3: Monitor (dejar corriendo)**
```bash
npm run monitor:security
```

**VS Code: Requests HTTP**
- Abrir `demo/authorization-demo.http`
- Ejecutar requests en orden (Click en "Send Request")

**Terminal 2: Tests**
```bash
npm test -- authorization.http.test.ts
npm test -- socketAuthMiddleware.test.ts
```

---

## 📁 Archivos Generados

Después de ejecutar los comandos, se generan:

```
audit/
├── security-audit-report.json      ← audit:endpoints
├── security-logs-report.json       ← monitor:security
└── unprotected_routes.json         ← Existente

logs/
└── app.log                          ← Servidor

coverage/
└── lcov-report/index.html          ← npm test
```

---

## 🎬 Script Rápido (5 minutos)

```bash
# Verificación
npm run verify:demo

# Auditoría
npm run audit:endpoints

# Generar tokens
npm run generate:token all

# Monitor (en otra terminal, dejar corriendo)
npm run monitor:security

# Ejecutar requests en VS Code: demo/authorization-demo.http

# Tests
npm test -- authorization.http.test.ts
```

---

## 💡 Tips

### Copiar Token Rápido
```bash
npm run generate:token valid
# Copiar el token que empieza con "Bearer ey..."
```

### Ver Logs en Tiempo Real
```bash
# Windows PowerShell
Get-Content logs/app.log -Wait -Tail 20

# Si el comando de monitor no funciona
```

### Limpiar Reportes Anteriores
```bash
Remove-Item audit/*.json -ErrorAction SilentlyContinue
```

### Reiniciar Todo
```bash
# Detener servidor (Ctrl+C)
# Detener monitor (Ctrl+C)
# Limpiar logs
Remove-Item logs/*.log -ErrorAction SilentlyContinue
# Reiniciar
npm run dev
```

---

## 🆘 Solución de Problemas

### Error: "ts-node not found"
```bash
npm install
```

### Error: "Cannot find module"
```bash
npm install
npm run build
```

### Monitor no funciona
```bash
# Alternativa: ver logs directamente
Get-Content logs/app.log -Wait -Tail 20
```

### Servidor no inicia
```bash
# Verificar MongoDB
# Verificar .env
# Ver logs de error
```

### Token no funciona en requests
```bash
# Asegúrate de incluir "Bearer " antes del token
# Verifica que el token no haya expirado
# Genera uno nuevo: npm run generate:token valid
```

---

## 📚 Documentación Relacionada

| Archivo | Descripción |
|---------|-------------|
| `demo/QUICK_START.md` | Guía rápida de 5 minutos |
| `demo/AUTHORIZATION_DEMO_README.md` | Guía detallada completa |
| `demo/PRESENTATION_CHECKLIST.md` | Checklist para presentación |
| `demo/SUMMARY.md` | Resumen ejecutivo |
| `demo/authorization-demo.http` | Requests HTTP ejecutables |

---

## ✅ Checklist de Comandos Esenciales

Para el jurado, debes ejecutar mínimo:

- [ ] `npm run verify:demo` - Verificar setup
- [ ] `npm run audit:endpoints` - Mostrar 100% protección
- [ ] `npm run generate:token all` - Generar tokens
- [ ] `npm run monitor:security` - Monitor en tiempo real
- [ ] Ejecutar requests en `demo/authorization-demo.http`
- [ ] `npm test -- authorization.http.test.ts` - Tests

**Tiempo total:** 10-15 minutos

---

**Última actualización:** Diciembre 4, 2025
