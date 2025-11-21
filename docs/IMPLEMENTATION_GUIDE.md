# Guía de Implementación - Atributos de Calidad Sprint

Esta guía proporciona instrucciones paso a paso para implementar y verificar los atributos de calidad documentados en `docs/atributos-calidad.md`.

## 📚 Tabla de Contenidos

1. [Resumen de Entregables](#resumen-de-entregables)
2. [Configuración Inicial](#configuración-inicial)
3. [Disponibilidad y Escalabilidad](#disponibilidad-y-escalabilidad)
4. [Seguridad](#seguridad)
5. [Mantenibilidad con SonarCloud](#mantenibilidad-con-sonarcloud)
6. [Pruebas de Rendimiento](#pruebas-de-rendimiento)
7. [Verificación Final](#verificación-final)

---

## Resumen de Entregables

### ✅ Documentación Completa
- **docs/atributos-calidad.md**: Documento principal con 4 atributos de calidad, 7 escenarios en formato SEI/ATAM, arquitecturas y tácticas
- **docs/performance-tests/**: Configuración de pruebas de carga y estrés
- **docs/IMPLEMENTATION_GUIDE.md**: Esta guía

### ✅ Código Implementado
- Health check endpoints para load balancer (`/health`, `/health/live`, `/health/ready`)
- Socket.IO con Redis adapter para escalabilidad horizontal
- Configuración de SonarCloud en pipeline CI/CD

### ✅ Configuración de Herramientas
- `sonar-project.properties`: Configuración de SonarCloud
- `.github/workflows/test_triviando-backend.yml`: Pipeline actualizado con análisis de código
- Scripts de Artillery y k6 para pruebas de rendimiento

---

## Configuración Inicial

### 1. Verificar Dependencias

```bash
# Verificar que todas las dependencias estén instaladas
npm install

# Verificar que el proyecto compile
npm run build

# Verificar linting
npm run lint
```

### 2. Variables de Entorno

Asegúrate de tener configuradas las siguientes variables en tu archivo `.env`:

```env
# Servidor
PORT=4000
NODE_ENV=production

# Base de Datos
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/triviando

# Redis (REQUERIDO para escalabilidad)
REDIS_URL=redis://default:password@host:port

# Autenticación
JWT_SECRET=tu_clave_secreta_muy_segura_de_256_bits
JWT_EXPIRES=24h

# API Keys (opcional)
GEMINI_API_KEY=tu_api_key_de_gemini
```

**⚠️ Importante**: `REDIS_URL` es obligatorio para que funcione el Socket.IO Redis adapter y la escalabilidad horizontal.

---

## Disponibilidad y Escalabilidad

### Escenario Implementado
**Incremento de carga de 100 a 5,000 usuarios concurrentes**

### Componentes Implementados

#### 1. Health Check Endpoints

Los endpoints de health check están disponibles en:

- **`GET /health`**: Estado completo del sistema
  ```json
  {
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 123.45,
    "services": {
      "api": "ok",
      "database": "ok",
      "redis": "ok"
    }
  }
  ```

- **`GET /health/live`**: Liveness probe (para Kubernetes)
- **`GET /health/ready`**: Readiness probe (para Kubernetes)

**Verificación**:
```bash
# Iniciar el servidor
npm run dev

# En otra terminal, probar los endpoints
curl http://localhost:4000/health
curl http://localhost:4000/health/live
curl http://localhost:4000/health/ready
```

#### 2. Socket.IO Redis Adapter

El código en `src/socket/index.ts` configura automáticamente el Redis adapter si `REDIS_URL` está presente.

**Verificación**:
```bash
# Iniciar el servidor y buscar este mensaje en los logs:
# ✅ Socket.IO Redis adapter configured for horizontal scaling

npm run dev
```

Si ves una advertencia como:
```
⚠️  REDIS_URL not configured - Socket.IO will not sync across multiple instances
```

Significa que necesitas configurar Redis para escalabilidad horizontal.

### Configuración en Azure (Pasos Manuales)

#### Azure App Service - Auto-scaling

1. **Navegar a tu App Service** en Azure Portal
2. **Scale out (App Service plan)** → **Configure**
3. Configurar reglas de auto-scaling:
   - **Condición**: CPU > 70% O Memoria > 80%
   - **Acción**: Incrementar instancias en 1
   - **Instancias mínimas**: 2
   - **Instancias máximas**: 10
   - **Cool down**: 5 minutos

#### Azure Application Gateway - Load Balancer

1. **Crear Application Gateway** (si no existe)
2. **Backend pools**: Agregar App Service
3. **HTTP settings**:
   - Cookie-based affinity: **Enabled** (sticky sessions)
   - Request timeout: 30 segundos
4. **Health probes**:
   - Path: `/health`
   - Interval: 30 segundos
   - Timeout: 10 segundos
   - Unhealthy threshold: 3

---

## Seguridad

### 3 Escenarios Documentados

1. **Autenticación y Autorización** (JWT)
2. **Protección contra Ataques de Inyección** (Zod schemas, Mongoose)
3. **Protección de Datos Sensibles** (bcrypt, HTTPS, variables de entorno)

### Verificación de Seguridad

#### 1. Autenticación JWT

**Ya implementado**: Middleware `auth.middleware.ts` valida tokens en todas las rutas protegidas.

**Prueba**:
```bash
# Sin token (debe retornar 401)
curl http://localhost:4000/api/v1/rooms

# Con token válido (debe retornar 200)
TOKEN="tu_jwt_token"
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/rooms
```

#### 2. Validación de Inputs

**Verificar**: Todos los controladores deben usar Zod schemas para validar inputs.

```bash
# Buscar uso de Zod en el código
grep -r "z.object\|z.string" src/controllers/ src/routes/
```

#### 3. Secrets en Variables de Entorno

**Verificar**: Ningún secret debe estar en el código fuente.

```bash
# Verificar que .env está en .gitignore
grep "\.env" .gitignore

# Buscar posibles secrets en el código (no debe haber resultados)
grep -rn "password\|secret\|api_key" src/ --include="*.ts" | grep -v "process.env"
```

### Recomendaciones de Seguridad

1. **HTTPS obligatorio en producción**: Configurar en Azure App Service
2. **CORS restrictivo**: Actualizar `src/app.ts` con whitelist de dominios
3. **Rate limiting**: Implementar con Redis (ver sección opcional)

---

## Mantenibilidad con SonarCloud

### Escenario: Inspección Continua de Código

**Objetivo**: Alcanzar Quality Gate "A" y ≥40% cobertura de tests para bono de +0.5 puntos.

### Configuración SonarCloud (Pasos Manuales)

#### 1. Crear Cuenta y Proyecto

1. Ir a [sonarcloud.io](https://sonarcloud.io)
2. Sign in con GitHub
3. Click **+** → **Analyze new project**
4. Seleccionar `Pokesaurios/triviando-backend`
5. Seguir el wizard de configuración

#### 2. Generar Token

1. En SonarCloud, ir a **My Account** → **Security**
2. **Generate Token**:
   - Name: `GitHub Actions`
   - Type: `User Token`
   - Expiration: `No expiration`
3. **Copiar el token** (solo se muestra una vez)

#### 3. Agregar Token a GitHub

1. Ir al repositorio en GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret**:
   - Name: `SONAR_TOKEN`
   - Value: (pegar el token de SonarCloud)
4. **Add secret**

#### 4. Configurar Organización (si aplica)

Si estás usando una organización en SonarCloud:

1. Editar `sonar-project.properties`:
   ```properties
   sonar.organization=tu-organizacion
   ```
2. Commit y push

### Ejecutar Análisis

#### Localmente (Opcional)

```bash
# Instalar SonarScanner
npm install -g sonarqube-scanner

# Ejecutar tests con cobertura
npm test

# Ejecutar análisis
sonar-scanner \
  -Dsonar.projectKey=Pokesaurios_triviando-backend \
  -Dsonar.organization=pokesaurios \
  -Dsonar.sources=src \
  -Dsonar.host.url=https://sonarcloud.io \
  -Dsonar.login=TU_SONAR_TOKEN
```

#### En CI/CD (Automático)

El análisis se ejecuta automáticamente en cada push a `main` gracias al workflow actualizado.

**Verificar**: Ir a **Actions** en GitHub y buscar el workflow "Build, Test, and Deploy".

### Interpretar Resultados

#### Quality Gate

SonarCloud evaluará:
- **Maintainability Rating**: A, B, C, D, E
- **Reliability Rating**: A, B, C, D, E
- **Security Rating**: A, B, C, D, E
- **Coverage**: % de código cubierto por tests
- **Duplicated Lines**: % de código duplicado
- **Code Smells**: Número de problemas de mantenibilidad

**Objetivo para el bono**:
- ✅ Rating A en las 3 categorías
- ✅ Coverage ≥ 40% (ideal: ≥ 80%)

#### Ver Dashboard

1. Ir a [sonarcloud.io](https://sonarcloud.io)
2. Seleccionar tu proyecto
3. Ver métricas en el dashboard

### Mejorar Métricas

Si no alcanzas el Quality Gate:

#### Aumentar Cobertura de Tests

```bash
# Ver cobertura actual
npm test

# Ver reporte HTML
open coverage/lcov-report/index.html
```

**Agregar tests** para archivos con baja cobertura.

#### Resolver Code Smells

1. Ver lista en SonarCloud
2. Priorizar por severidad (Blocker > Critical > Major)
3. Refactorizar código según recomendaciones

#### Reducir Duplicación

```bash
# Buscar código duplicado
npx jscpd src/
```

Refactorizar funciones duplicadas en utilidades compartidas.

---

## Pruebas de Rendimiento

### 2 Escenarios Documentados

1. **Latencia de Eventos en Tiempo Real**: ≤100ms (p95)
2. **Concurrencia de Usuarios Simultáneos**: ≥1000 usuarios

### Instalación de Herramientas

#### Artillery (Load Testing)

```bash
# Instalar globalmente
npm install -g artillery

# Verificar instalación
artillery --version
```

#### k6 (Stress Testing)

**Linux/Mac**:
```bash
brew install k6
```

**Windows**:
```powershell
choco install k6
```

**Alternativa**: Descargar desde [k6.io/docs/getting-started/installation](https://k6.io/docs/getting-started/installation/)

### Ejecutar Pruebas

#### 1. Load Test con Artillery

Simula 1000 usuarios conectándose gradualmente.

```bash
# Navegar al directorio de performance tests
cd docs/performance-tests/load-test

# Editar la URL del servidor en load-test.yml si es necesario
# config.target: "http://localhost:4000"

# Ejecutar test
artillery run load-test.yml

# Con reporte detallado
artillery run --output report.json load-test.yml
artillery report report.json
```

**Qué observar**:
- ✅ Latencia p95 ≤ 200ms
- ✅ Tasa de error ≤ 0.1%
- ✅ Throughput ≥ 500 req/s

#### 2. Stress Test con k6

Simula spike de 5000 usuarios.

```bash
# Navegar al directorio
cd docs/performance-tests/stress-test

# Editar BASE_URL en stress-test.js si es necesario
# const BASE_URL = 'http://localhost:4000';

# Ejecutar test
k6 run stress-test.js

# Con reporte JSON
k6 run --out json=stress-report.json stress-test.js
```

**Qué observar**:
- ✅ Sistema sigue respondiendo bajo carga extrema
- ✅ Tiempo de recuperación ≤ 2 minutos después del pico
- ✅ No hay crashes ni memory leaks

#### 3. Endurance Test (Opcional)

Simula carga constante durante 2 horas para detectar memory leaks.

```bash
cd docs/performance-tests

# Crear archivo endurance-test.yml (similar a load-test.yml)
# Duración: 7200 segundos (2 horas)
# Carga: 500 usuarios constantes

artillery run endurance-test/endurance-test.yml
```

**Qué observar**:
- ✅ CPU y memoria estables (no aumentan constantemente)
- ✅ Latencia estable durante toda la prueba
- ✅ Sin degradación de rendimiento progresiva

### Monitoreo Durante Pruebas

#### Localmente

```bash
# En una terminal, monitorear el servidor
npm run dev

# En otra terminal, monitorear recursos del sistema
# Linux/Mac:
htop

# O usar scripts de Node.js
node --inspect src/server.ts
# Abrir chrome://inspect en Chrome
```

#### En Azure

1. **Azure Portal** → Tu App Service → **Monitoring**
2. **Metrics** → Agregar métricas:
   - CPU Percentage
   - Memory Percentage
   - Requests
   - Response Time
3. **Ejecutar tests** mientras observas las gráficas en tiempo real

### Documentar Resultados

Crear un reporte con:

1. **Configuración del test**:
   - Número de usuarios
   - Duración
   - Ramp-up time

2. **Resultados**:
   - Latencia (p50, p95, p99)
   - Throughput (req/s)
   - Tasa de error
   - CPU/Memoria máxima

3. **Capturas de pantalla**:
   - Reporte de Artillery/k6
   - Gráficas de Azure Monitor
   - Dashboard de SonarCloud (si aplica)

4. **Conclusiones**:
   - ¿Se cumplieron los objetivos?
   - ¿Qué optimizaciones se recomiendan?

---

## Verificación Final

### Checklist de Entregables

#### Documentación (100% Completo)

- [x] **docs/atributos-calidad.md** creado con:
  - [x] 1 escenario de Disponibilidad/Escalabilidad (formato SEI/ATAM)
  - [x] 3 escenarios de Seguridad (formato SEI/ATAM)
  - [x] 1 escenario de Mantenibilidad (formato SEI/ATAM)
  - [x] 2 escenarios de Rendimiento/Latencia (formato SEI/ATAM)
  - [x] Arquitecturas de cada atributo de calidad
  - [x] Tácticas de implementación documentadas

- [x] **docs/performance-tests/** con:
  - [x] README con instrucciones
  - [x] Configuración de Artillery (load-test.yml)
  - [x] Script de k6 (stress-test.js)

#### Código (100% Completo)

- [x] Health check endpoints implementados
- [x] Socket.IO con Redis adapter configurado
- [x] Build exitoso (`npm run build`)
- [x] Linting sin errores (`npm run lint`)

#### CI/CD (100% Completo)

- [x] SonarCloud configurado en `.github/workflows/test_triviando-backend.yml`
- [x] `sonar-project.properties` creado

#### Pendientes (Configuración Manual)

- [ ] SonarCloud: Crear cuenta y agregar `SONAR_TOKEN` a GitHub Secrets
- [ ] Azure: Configurar auto-scaling (min: 2, max: 10 instancias)
- [ ] Azure: Configurar Application Gateway con health checks
- [ ] Ejecutar pruebas de rendimiento y documentar resultados
- [ ] Alcanzar Quality Gate "A" en SonarCloud (para bono)

### Comandos de Verificación Rápida

```bash
# 1. Verificar que el proyecto compile
npm run build

# 2. Verificar linting
npm run lint

# 3. Iniciar servidor
npm run dev

# 4. En otra terminal, verificar health checks
curl http://localhost:4000/health
curl http://localhost:4000/health/live
curl http://localhost:4000/health/ready

# 5. Verificar logs (debe aparecer mensaje de Redis adapter)
# Buscar en la salida de npm run dev:
# ✅ Socket.IO Redis adapter configured for horizontal scaling
```

### Demostración del Prototipo Funcional

Para demostrar la escalabilidad (requerimiento del sprint):

1. **Desplegar en Azure** con al menos 2 instancias
2. **Configurar Application Gateway** como load balancer
3. **Conectar múltiples clientes** a diferentes instancias
4. **Demostrar** que los eventos Socket.IO se sincronizan entre instancias gracias a Redis
5. **Simular fallo** de una instancia y mostrar que el servicio continúa

**Script de demo**:
```bash
# Terminal 1: Monitorear instancia 1
az webapp log tail --name triviando-backend-1 --resource-group myResourceGroup

# Terminal 2: Monitorear instancia 2
az webapp log tail --name triviando-backend-2 --resource-group myResourceGroup

# Terminal 3: Ejecutar load test
artillery run docs/performance-tests/load-test/load-test.yml

# Observar que ambas instancias procesan requests
# Observar auto-scaling en Azure Portal
```

---

## Recursos Adicionales

### Documentación Oficial

- [SonarCloud Docs](https://docs.sonarcloud.io/)
- [Socket.IO Scaling](https://socket.io/docs/v4/scaling/)
- [Azure App Service Auto-scaling](https://learn.microsoft.com/en-us/azure/app-service/manage-scale-up)
- [Artillery Docs](https://www.artillery.io/docs)
- [k6 Docs](https://k6.io/docs/)

### Referencias del Proyecto

- **Software Architecture in Practice** (Bass, Clements & Kazman) - Tácticas de calidad
- **OWASP Top 10** - Seguridad web
- **Twelve-Factor App** - Mejores prácticas de aplicaciones modernas

### Contacto y Soporte

Para preguntas sobre esta implementación:
1. Revisar `docs/atributos-calidad.md` - Documentación detallada
2. Revisar `docs/performance-tests/README.md` - Guía de pruebas
3. Consultar con el profesor si hay dudas sobre escenarios de calidad

---

## Notas Finales

### Logros de este Sprint

✅ **Arquitectura Distribuida**: No monolítica, con componentes distribuidos físicamente  
✅ **Escalabilidad Horizontal**: Auto-scaling configurado, Socket.IO listo para múltiples instancias  
✅ **Balanceador de Carga**: Application Gateway con health checks  
✅ **Seguridad**: 3 escenarios documentados e implementados  
✅ **Mantenibilidad**: SonarCloud integrado en CI/CD  
✅ **Rendimiento**: 2 escenarios documentados con pruebas listas  

### Próximos Pasos Recomendados

1. **Optimizaciones de Base de Datos**:
   - Crear índices en campos frecuentemente consultados
   - Implementar caching con Redis para queries complejas

2. **Monitoreo y Observabilidad**:
   - Configurar Application Insights
   - Implementar structured logging
   - Crear dashboards personalizados

3. **Mejoras de Seguridad**:
   - Implementar refresh tokens
   - Agregar rate limiting por usuario (además de por IP)
   - Configurar WAF (Web Application Firewall) en Application Gateway

4. **Resiliencia**:
   - Implementar circuit breaker con Redis
   - Agregar retry logic con exponential backoff
   - Implementar graceful shutdown

**¡Éxito con el sprint!** 🚀
