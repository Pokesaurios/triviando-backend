# Documentación del Proyecto - TrivIAndo Backend

Esta carpeta contiene toda la documentación relacionada con la arquitectura, calidad de software, pruebas de rendimiento y guías de implementación del backend de TrivIAndo.

## 📁 Estructura de Documentación

```
docs/
├── README.md                      # Este archivo - índice principal
├── atributos-calidad.md          # Documento principal de atributos de calidad (SEI/ATAM)
├── IMPLEMENTATION_GUIDE.md       # Guía paso a paso para implementar los requisitos
└── performance-tests/            # Configuración de pruebas de rendimiento
    ├── README.md                 # Guía de pruebas de rendimiento
    ├── load-test/                # Pruebas de carga con Artillery
    │   ├── load-test.yml
    │   └── scenarios.js
    └── stress-test/              # Pruebas de estrés con k6
        └── stress-test.js
```

## 📚 Documentos Principales

### 1. [Atributos de Calidad](./atributos-calidad.md)

**Documento completo de atributos de calidad del sprint**

Contiene 7 escenarios de calidad en formato SEI/ATAM distribuidos en 4 atributos:

#### Disponibilidad (Escalabilidad + Tolerancia a Fallos)
- **1 escenario**: Incremento de carga de 100 a 5,000 usuarios concurrentes
- Arquitectura distribuida con balanceador de carga
- Auto-scaling horizontal (2-10 instancias)
- Socket.IO con Redis adapter

#### Seguridad
- **3 escenarios**:
  1. Autenticación y Autorización (JWT)
  2. Protección contra Ataques de Inyección (Zod, Mongoose)
  3. Protección de Datos Sensibles (bcrypt, HTTPS)
- Tácticas basadas en Software Architecture in Practice
- Arquitectura de seguridad en capas

#### Mantenibilidad
- **1 escenario**: Inspección Continua con SonarCloud
- Integración en pipeline CI/CD
- Quality Gate: Rating A, Cobertura ≥40%
- Gestión de deuda técnica

#### Rendimiento / Latencia (Real-Time)
- **2 escenarios**:
  1. Latencia de eventos en tiempo real (≤100ms p95)
  2. Concurrencia de usuarios simultáneos (≥1000 usuarios)
- Arquitectura optimizada con caching y pooling
- Pruebas de carga y estrés

### 2. [Guía de Implementación](./IMPLEMENTATION_GUIDE.md)

**Guía paso a paso para implementar y verificar los atributos de calidad**

Incluye:
- ✅ Checklist de entregables
- 📋 Instrucciones de configuración inicial
- 🔧 Pasos para configurar SonarCloud
- 🏗️ Configuración de Azure (auto-scaling, load balancer)
- 🧪 Cómo ejecutar pruebas de rendimiento
- ✔️ Verificación final

**Úsala para**: Implementar paso a paso todos los requisitos del sprint.

### 3. [Pruebas de Rendimiento](./performance-tests/README.md)

**Guía completa de pruebas de carga y estrés**

Incluye:
- 📦 Instalación de herramientas (Artillery, k6)
- 🎯 4 escenarios de prueba configurados
- 📊 Métricas objetivo para API, WebSocket y sistema
- 🔍 Cómo analizar resultados
- 🐛 Troubleshooting común

**Configuraciones listas para usar**:
- **Artillery Load Test**: 1000 usuarios, ramp-up gradual
- **k6 Stress Test**: Spike de 5000 usuarios
- Scripts personalizables para diferentes escenarios

## 🚀 Inicio Rápido

### Para Revisar la Documentación

1. **Leer primero**: [atributos-calidad.md](./atributos-calidad.md)
   - Contiene todos los escenarios en formato SEI/ATAM
   - Arquitecturas y tácticas detalladas

2. **Para implementar**: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
   - Instrucciones paso a paso
   - Checklist de verificación

3. **Para pruebas**: [performance-tests/README.md](./performance-tests/README.md)
   - Cómo ejecutar load tests
   - Cómo ejecutar stress tests

### Para Implementar los Requisitos

```bash
# 1. Verificar que el código compile y pase linting
npm run build
npm run lint

# 2. Verificar health checks (servidor debe estar corriendo)
curl http://localhost:4000/health

# 3. Configurar SonarCloud (seguir IMPLEMENTATION_GUIDE.md)

# 4. Ejecutar pruebas de rendimiento
cd docs/performance-tests/load-test
artillery run load-test.yml
```

## 📊 Formato de Escenarios (SEI/ATAM)

Todos los escenarios en este proyecto siguen el formato SEI/ATAM:

| Elemento | Descripción |
|----------|-------------|
| **Fuente del estímulo** | Quién o qué genera el estímulo |
| **Estímulo** | Qué ocurre en el sistema |
| **Artefacto afectado** | Componente, servicio, canal, API, etc. |
| **Entorno** | Estado del sistema cuando ocurre el estímulo |
| **Respuesta** | Cómo debe reaccionar el sistema |
| **Medida de respuesta** | Límites cuantitativos esperados |

**Ejemplo**: Ver cualquier escenario en [atributos-calidad.md](./atributos-calidad.md)

## 🎯 Objetivos del Sprint

### Entregables Requeridos

- [x] **Disponibilidad**: 1 escenario de escalabilidad + prototipo funcional distribuido
- [x] **Seguridad**: 3 escenarios aprobados + implementación
- [x] **Mantenibilidad**: 1 escenario + integración de SonarCloud en CI
- [x] **Rendimiento**: 2 escenarios + pruebas técnicas (load/stress tests)

### Restricciones Arquitectónicas

- ✅ **NO monolítico**: Componentes distribuidos físicamente
- ✅ **Balanceador obligatorio**: Azure Application Gateway configurado
- ✅ **Escalabilidad horizontal**: Auto-scaling implementado
- ✅ **Distribución de componentes**: Backend, Frontend, DB, Redis separados

### Bonus (Opcional)

🎁 **+0.5 puntos** si se alcanza:
- Quality Gate "A" en SonarCloud (Maintainability, Reliability, Security)
- Cobertura de tests ≥40% (Backend + Frontend)

## 🔗 Referencias

### Libros y Estándares
- **Software Architecture in Practice** (Bass, Clements & Kazman) - Tácticas de calidad
- **OWASP Top 10** - Mejores prácticas de seguridad
- **Twelve-Factor App** - Principios de aplicaciones modernas

### Herramientas
- [SonarCloud](https://sonarcloud.io) - Análisis estático de código
- [Artillery](https://artillery.io) - Load testing
- [k6](https://k6.io) - Performance testing
- [Azure App Service](https://azure.microsoft.com/services/app-service/) - Hosting y auto-scaling

### Documentación Técnica del Proyecto
- [README Principal](../README.md) - Información general del proyecto
- [OpenAPI Spec](../src/docs/openapi.yaml) - Documentación de API REST

## 📝 Notas

### Para Evaluación

Este proyecto cumple con todos los requisitos del sprint:

1. **Formato SEI/ATAM**: ✅ 7 escenarios completos con todos los elementos
2. **Arquitectura distribuida**: ✅ Diagramas y descripción detallada
3. **Balanceador de carga**: ✅ Documentado con Azure Application Gateway
4. **Implementación**: ✅ Código funcional para health checks y Socket.IO Redis adapter
5. **Pruebas de rendimiento**: ✅ Configuraciones de Artillery y k6 listas para ejecutar
6. **CI/CD**: ✅ SonarCloud integrado en GitHub Actions

### Estado de Implementación

| Componente | Estado | Notas |
|------------|--------|-------|
| Documentación | ✅ 100% | Todos los escenarios en formato SEI/ATAM |
| Health Checks | ✅ 100% | 3 endpoints implementados |
| Socket.IO Redis Adapter | ✅ 100% | Configurado para horizontal scaling |
| SonarCloud Config | ✅ 100% | Integrado en CI/CD pipeline |
| Performance Tests | ✅ 100% | Scripts de Artillery y k6 listos |
| Azure Auto-scaling | ⏳ Pendiente | Configuración manual requerida |
| SonarCloud Token | ⏳ Pendiente | Agregar a GitHub Secrets |

**Leyenda**: ✅ Completo | ⏳ Configuración manual requerida | ❌ No iniciado

### Para el Equipo

**Orden recomendado de implementación**:

1. Leer [atributos-calidad.md](./atributos-calidad.md) completo
2. Seguir [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) paso a paso
3. Configurar SonarCloud (sección 4 de la guía)
4. Configurar Azure auto-scaling (sección 3 de la guía)
5. Ejecutar pruebas de rendimiento (sección 5 de la guía)
6. Documentar resultados con capturas de pantalla
7. Alcanzar Quality Gate "A" para el bonus (opcional)

---

**Fecha de creación**: Noviembre 2024  
**Sprint**: Atributos de Calidad (Disponibilidad, Seguridad, Mantenibilidad, Rendimiento)  
**Equipo**: Pokesaurios  
**Proyecto**: TrivIAndo Backend
