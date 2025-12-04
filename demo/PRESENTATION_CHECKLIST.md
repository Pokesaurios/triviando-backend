# ✅ Checklist de Presentación - Escenario de Autorización

**Fecha:** _____________  **Hora:** _____________  **Jurado:** _____________________

---

## 📋 PRE-DEMOSTRACIÓN (5 min antes)

### Verificación Técnica
- [ ] Servidor corriendo: `npm run dev`
- [ ] MongoDB conectado (verificar en logs)
- [ ] Redis activo (verificar en logs)
- [ ] `.env` configurado (JWT_SECRET, MONGO_URI, etc.)
- [ ] Navegador con http://localhost:3000/api-docs abierto (opcional)

### Preparación de Terminales
- [ ] Terminal 1: Servidor corriendo
- [ ] Terminal 2: Preparada para comandos de demo
- [ ] Terminal 3: Preparada para monitor (opcional)

### Archivos Abiertos en VS Code
- [ ] `demo/authorization-demo.http`
- [ ] `demo/QUICK_START.md` (referencia)
- [ ] `src/middleware/auth.middleware.ts` (para mostrar código)

---

## 🎯 DEMOSTRACIÓN (15-20 min)

### 1. Introducción (1 min)
**Script:**
> "Vamos a demostrar el escenario de autorización. El sistema debe proteger todos los endpoints y rechazar accesos no autorizados, registrando todos los intentos fallidos."

- [ ] Mencioné el objetivo del escenario
- [ ] Expliqué qué se va a demostrar

---

### 2. Auditoría de Endpoints (3 min)
**Comando:**
```bash
npm run audit:endpoints
```

**Puntos a señalar:**
- [ ] Total de endpoints analizados
- [ ] **Tasa de protección: 100%** ⭐
- [ ] Socket.IO también protegido
- [ ] Solo login/register sin protección (públicos)
- [ ] Archivo generado: `audit/security-audit-report.json`

**Script:**
> "Esta herramienta analiza automáticamente todos los endpoints. Como pueden ver, el 100% de los endpoints críticos están protegidos con middleware de autenticación."

---

### 3. Generación de Tokens (2 min)
**Comando:**
```bash
npm run generate:token all
```

**Acción:**
- [ ] Generé 4 tipos de tokens
- [ ] Copié token válido
- [ ] Copié token expirado
- [ ] Expliqué diferencias entre tokens

**Script:**
> "Generamos diferentes tipos de tokens para las pruebas: válidos, expirados e inválidos. Esto simula diferentes escenarios de ataque."

---

### 4. Monitor de Seguridad (1 min)
**Comando (Terminal 3):**
```bash
npm run monitor:security
```

**Puntos:**
- [ ] Monitor iniciado en terminal separada
- [ ] Expliqué qué captura (intentos, clasificación, IPs)
- [ ] Mencioné que se actualizará en tiempo real

**Script:**
> "Este monitor captura en tiempo real todos los intentos de autenticación, clasificando los errores y registrando las IPs."

---

### 5. Requests HTTP - Escenarios (7 min)

**Archivo:** `demo/authorization-demo.http`

#### A. Crear usuario y login (1.5 min)
- [ ] Ejecuté PASO 1: Register → `201 Created`
- [ ] Ejecuté PASO 2: Login → `200 OK`
- [ ] **Copié el token** recibido
- [ ] Reemplacé `{{validToken}}` en el archivo

#### B. Sin token - 401 (1.5 min)
- [ ] Ejecuté A1: Crear sala sin token → `401`
- [ ] Ejecuté A2: Ver perfil sin token → `401`
- [ ] Mostré respuesta: `"Token not provided or invalid"`
- [ ] **Alterné al monitor** → mostré logs capturados

**Script:**
> "Sin token, el sistema rechaza inmediatamente con 401 y registra el intento en logs."

#### C. Token inválido - 401 (1 min)
- [ ] Ejecuté B1: Token sin "Bearer" → `401`
- [ ] Ejecuté B2: Token malformado → `401`
- [ ] Mostré en monitor: "Token inválido"

#### D. Token expirado - 401 (1 min)
- [ ] Pegué token expirado generado
- [ ] Ejecuté C1: Token expirado → `401`
- [ ] Mostré respuesta: `"Token invalid or expired"`

**Script:**
> "El sistema valida automáticamente la expiración. Después de 3 horas, el token no es válido."

#### E. Token válido - 200 (1 min)
- [ ] Ejecuté D1: Ver perfil → `200 OK`
- [ ] Ejecuté D2: Crear sala → `200 OK`
- [ ] Mostré datos retornados correctamente

**Script:**
> "Con token válido, el acceso es permitido y el sistema responde normalmente."

#### F. Sin permisos - 403 (1 min)
- [ ] Creé segundo usuario (E1, E2)
- [ ] Intenté acceder a sala del primer usuario (E3) → `403 Forbidden`
- [ ] Mostré mensaje: `"You are not authorized..."`

**Script:**
> "Aquí el usuario está autenticado, pero no tiene permisos sobre este recurso. Por eso retorna 403 en lugar de 401."

---

### 6. Revisión del Monitor (2 min)
**Volver a Terminal 3 (monitor)**

**Puntos a mostrar:**
- [ ] Total de intentos registrados
- [ ] Exitosos vs fallidos
- [ ] 401 (no autorizados) vs 403 (no autorizados)
- [ ] Clasificación de errores
- [ ] IPs únicas
- [ ] Últimos eventos

**Script:**
> "El monitor ha capturado todos los intentos. Como ven, cada fallo está clasificado: token no proporcionado, inválido, expirado, sin permisos. El 100% de intentos fallidos fue registrado."

---

### 7. Tests Automatizados (2 min)
**Comandos:**
```bash
npm test -- authorization.http.test.ts
npm test -- socketAuthMiddleware.test.ts
```

**Puntos:**
- [ ] Tests de autorización HTTP → ✅ Pasando
- [ ] Tests de Socket.IO → ✅ Pasando
- [ ] Mencioné que se ejecutan en CI/CD

**Script:**
> "Los tests automatizados verifican estos escenarios constantemente. Se ejecutan en cada commit para garantizar que la seguridad no se rompa."

---

### 8. Resumen y Conclusión (2 min)

**Medidas de respuesta cumplidas:**
- [ ] ✅ Validar token JWT en cada request
- [ ] ✅ Verificar expiración (3h)
- [ ] ✅ Verificar permisos del usuario
- [ ] ✅ Rechazar requests sin autenticación (401)
- [ ] ✅ Rechazar requests sin autorización (403)
- [ ] ✅ Registrar intentos fallidos en logs
- [ ] ✅ **100% de endpoints protegidos**

**Script:**
> "En resumen, hemos demostrado las 7 medidas de respuesta del escenario:
> 1. Validación de token en todos los endpoints
> 2. Verificación automática de expiración
> 3. Validación de permisos por recurso
> 4. Rechazo 401 para no autenticados
> 5. Rechazo 403 para no autorizados
> 6. Registro completo de intentos fallidos
> 7. 100% de endpoints críticos protegidos
>
> El sistema cumple completamente con el escenario de calidad de autorización."

---

## 📊 EVIDENCIA RECOLECTADA

### Archivos Generados
- [ ] `audit/security-audit-report.json`
- [ ] `audit/security-logs-report.json`
- [ ] Logs en `logs/app.log`

### Capturas Tomadas (opcional)
- [ ] Salida de audit:endpoints (100%)
- [ ] Dashboard del monitor con métricas
- [ ] Respuestas HTTP 401, 403, 200
- [ ] Tests pasando
- [ ] Reportes JSON

---

## ❓ PREGUNTAS FRECUENTES DEL JURADO

### "¿Cómo garantizan que no se olviden de proteger un endpoint?"
**Respuesta:**
> "Tenemos una herramienta de auditoría automatizada (`audit:endpoints`) que escanea todos los archivos de rutas y verifica que tienen el middleware. Se ejecuta en CI/CD y falla el build si encuentra endpoints desprotegidos."

- [ ] Mencioné audit:endpoints
- [ ] Mencioné integración en CI/CD
- [ ] Mostré reporte JSON

### "¿Qué pasa si alguien intercepta un token?"
**Respuesta:**
> "El token tiene duración limitada (3h). Si es interceptado, expira automáticamente. Además, el sistema usa HTTPS en producción para cifrar la comunicación. El token también está firmado con un secreto, por lo que no puede ser modificado."

- [ ] Mencioné expiración (3h)
- [ ] Mencioné HTTPS
- [ ] Mencioné firma del token

### "¿Los WebSockets también están protegidos?"
**Respuesta:**
> "Sí, Socket.IO tiene su propio middleware de autenticación (`socketAuthMiddleware`). Cada conexión debe enviar un token JWT válido. La auditoría lo verifica."

- [ ] Mencioné socketAuthMiddleware
- [ ] Mostré en código si es necesario
- [ ] Mostré tests de Socket.IO

### "¿Cómo saben si alguien está intentando hackear el sistema?"
**Respuesta:**
> "Todos los intentos fallidos se registran con logs estructurados que incluyen IP, timestamp, razón del fallo. El monitor de seguridad clasifica automáticamente los tipos de ataque. Podemos configurar alertas para patrones sospechosos."

- [ ] Mencioné logs estructurados
- [ ] Mostré monitor con clasificación
- [ ] Mencioné posibilidad de alertas

### "¿Cuál es la diferencia entre 401 y 403?"
**Respuesta:**
> "401 significa que el usuario no está autenticado (sin token, token inválido o expirado). 403 significa que el usuario SÍ está autenticado con token válido, pero no tiene permisos sobre ese recurso específico. Por ejemplo, intentar ver una sala donde no es participante."

- [ ] Expliqué 401: no autenticado
- [ ] Expliqué 403: autenticado sin permisos
- [ ] Di ejemplo concreto

---

## 🎯 DESPUÉS DE LA PRESENTACIÓN

### Entrega de Documentos
- [ ] Copiar carpeta `demo/` completa
- [ ] Copiar carpeta `audit/` con reportes
- [ ] Incluir `README.md` actualizado
- [ ] Opcional: Captura de pantallas

### Evaluación Personal
**¿Qué salió bien?**
_________________________________
_________________________________

**¿Qué mejorar?**
_________________________________
_________________________________

**Reacción del jurado:**
- [ ] Satisfecho
- [ ] Neutral  
- [ ] Necesita aclaraciones

**Preguntas adicionales:**
_________________________________
_________________________________
_________________________________

---

## 📞 CONTACTOS DE EMERGENCIA

**Backup si falla algo:**
- Tener token pre-generado copiado
- Screenshots de evidencia guardadas
- PDF de reportes JSON
- Video de respaldo de demo (opcional)

**Documentación de referencia:**
- `demo/QUICK_START.md`
- `demo/AUTHORIZATION_DEMO_README.md`
- `demo/SUMMARY.md`

---

**✅ CHECKLIST COMPLETADA**

**Firma del presentador:** ______________________  **Fecha:** __________

**Resultado:** ⭐ ⭐ ⭐ ⭐ ⭐

**Notas finales:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
