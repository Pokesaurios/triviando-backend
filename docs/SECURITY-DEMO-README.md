# 🛡️ Demostración de Seguridad - Escenario 2

Este documento proporciona instrucciones rápidas para ejecutar la demostración de seguridad ante el jurado.

## 🎯 Objetivo

Demostrar el cumplimiento del **Escenario 2: Prevención ante ataques comunes** con evidencia objetiva y medible.

## 📋 Requisitos del Escenario

| Requisito | Estado |
|-----------|--------|
| 100% de inputs validados con Zod | ✅ Implementado |
| 0 vulnerabilidades en análisis estático | ✅ Verificado |
| Rechazar payloads inválidos (400 Bad Request) | ✅ Implementado |

## 🚀 Inicio Rápido

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Ejecutar Demostración Completa (Recomendado)

```bash
npm run demo:jury
```

Este comando ejecuta:
1. Análisis estático de seguridad
2. Demostración visual de ataques bloqueados
3. Genera reportes en `audit/`

### 3. Ver Reporte Visual

Abrir en el navegador:
```bash
# Windows
start audit/security-audit.html

# macOS
open audit/security-audit.html

# Linux
xdg-open audit/security-audit.html
```

## 📊 Comandos Individuales

### Análisis Estático de Código
```bash
npm run audit:security
```

**Muestra:**
- ✅ Cobertura de validación de endpoints
- ✅ Esquemas Zod implementados
- ✅ Score de seguridad
- ✅ Vulnerabilidades encontradas

### Demostración de Ataques en Vivo
```bash
npm run demo:attacks
```

**Muestra:**
- ✅ 40+ ataques simulados en tiempo real
- ✅ Visualización de payloads bloqueados
- ✅ Tasa de bloqueo (debe ser 100%)
- ✅ Tiempo de respuesta promedio

### Tests de Seguridad Completos
```bash
npm run test:security
```

**Muestra:**
- ✅ 150+ tests de seguridad
- ✅ Cobertura de 10 categorías de ataques
- ✅ Todos los tests deben pasar

### Auditoría Completa (Estático + Dinámico)
```bash
npm run audit:full
```

## 🎬 Demostración Sugerida para el Jurado

### Opción A: Demostración Completa (15 min)

```bash
# 1. Ejecutar análisis completo
npm run demo:jury

# 2. Abrir reporte HTML
start audit/security-audit.html

# 3. Ejecutar tests de seguridad
npm run test:security
```

### Opción B: Demostración Rápida (5 min)

```bash
# 1. Solo auditoría y demo visual
npm run demo:jury

# 2. Mostrar reporte HTML
start audit/security-audit.html
```

## 📈 Métricas Esperadas

| Métrica | Valor Esperado |
|---------|---------------|
| **Cobertura de Validación** | 100% |
| **Score de Seguridad** | 90+/100 |
| **Vulnerabilidades** | 0 |
| **Tests Pasados** | 150+/150+ (100%) |
| **Ataques Bloqueados** | 40+/40+ (100%) |

## 🔍 Categorías de Ataques Cubiertas

1. ✅ **NoSQL Injection** - Operadores MongoDB maliciosos
2. ✅ **XSS (Cross-Site Scripting)** - Scripts maliciosos
3. ✅ **SQL Injection** - Patrones SQL maliciosos
4. ✅ **Command Injection** - Comandos del sistema
5. ✅ **Path Traversal** - Acceso a archivos del sistema
6. ✅ **Prototype Pollution** - Contaminación de prototipos JS
7. ✅ **Buffer Overflow** - Strings extremadamente largos
8. ✅ **Invalid Data Types** - Tipos de datos incorrectos
9. ✅ **Missing Fields** - Campos requeridos faltantes
10. ✅ **Invalid Formats** - Formatos inválidos (email, etc.)

## 📁 Archivos de Evidencia

### Código Fuente
- `src/schemas/` - Esquemas Zod de validación
- `src/middleware/validate.ts` - Middleware de validación
- `src/routes/` - Rutas con validación aplicada

### Tests
- `tests/security.attacks.test.ts` - Suite de tests de seguridad (150+ tests)

### Scripts
- `scripts/security-audit.ts` - Análisis estático automatizado
- `scripts/live-attack-demo.ts` - Demostración visual de ataques

### Reportes Generados
- `audit/security-audit.json` - Reporte JSON estructurado
- `audit/security-audit.md` - Reporte Markdown
- `audit/security-audit.html` - Reporte HTML interactivo

## 📝 Verificación Manual

Si desea verificar manualmente los componentes:

### 1. Ver Esquemas Zod
```bash
cat src/schemas/auth.ts
cat src/schemas/room.ts
cat src/schemas/trivia.ts
cat src/schemas/game.ts
```

### 2. Ver Middleware de Validación
```bash
cat src/middleware/validate.ts
```

### 3. Ver Uso en Rutas
```bash
cat src/routes/auth.routes.ts
cat src/routes/room.routes.ts
```

## 🐛 Troubleshooting

### Error: "Cannot find module 'chalk'"
```bash
npm install
```

### Error: "MongoDB not connected"
Los scripts de auditoría y demo no requieren MongoDB. Solo los tests completos necesitan la base de datos.

Para ejecutar sin base de datos:
```bash
npm run audit:security  # No requiere DB
npm run demo:attacks    # No requiere DB (mock)
```

### Error: "Port already in use"
Asegúrese de que no hay otra instancia del servidor corriendo:
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

## 🎓 Argumentos para el Jurado

### 1. Cobertura Total (100%)
> "Cada punto de entrada al sistema está protegido con validación Zod. No existe ningún endpoint o handler que acepte datos sin validar."

**Evidencia:** Reporte de auditoría mostrando 0 endpoints sin validar.

### 2. Protección Multi-Capa
> "La validación no es un simple check, sino múltiples capas: tipo de dato, formato, longitud, patrones regex, y reglas de negocio."

**Evidencia:** Esquemas Zod en `src/schemas/` con validaciones complejas.

### 3. Tests Exhaustivos
> "Hemos probado más de 150 payloads maliciosos diferentes, cubriendo los ataques más comunes documentados en OWASP Top 10."

**Evidencia:** Tests pasando al 100% en `npm run test:security`.

### 4. Respuesta 400 Bad Request
> "Todos los payloads inválidos son rechazados inmediatamente con código HTTP 400, sin llegar a la lógica de negocio."

**Evidencia:** Demo en vivo mostrando respuestas 400 para todos los ataques.

### 5. Auditoría Continua
> "El proceso de auditoría está automatizado y se puede ejecutar en cualquier momento, incluso en CI/CD."

**Evidencia:** Script de auditoría que se ejecuta sin intervención manual.

## 🔗 Documentación Adicional

- [Guía completa de demostración](./SCENARIO-2-DEMONSTRATION.md)
- [Documentación de Zod](https://zod.dev/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## ✅ Checklist Pre-Demostración

Antes de presentar al jurado:

- [ ] Dependencias instaladas (`npm install`)
- [ ] Auditoría ejecutada sin errores (`npm run audit:security`)
- [ ] Demo de ataques ejecutada sin errores (`npm run demo:attacks`)
- [ ] Reporte HTML generado y se visualiza correctamente
- [ ] Tests de seguridad pasan al 100% (`npm run test:security`)
- [ ] Variables de entorno configuradas (`.env`)
- [ ] Navegador disponible para mostrar reporte HTML

## 🎉 Resultado Esperado

Al final de la demostración, el jurado tendrá evidencia de:

✅ **100% de inputs validados con Zod**  
✅ **0 vulnerabilidades en análisis estático**  
✅ **100% de payloads maliciosos bloqueados**  
✅ **Respuestas 400 Bad Request para todos los ataques**  

**= CUMPLIMIENTO TOTAL DEL ESCENARIO 2**

---

**¿Preguntas?** Consulte la [guía detallada](./SCENARIO-2-DEMONSTRATION.md) para más información.
