# Configuración de Pruebas de Rendimiento

Este directorio contiene las configuraciones y scripts para realizar pruebas de carga, estrés y rendimiento del backend de TrivIAndo.

## Herramientas Requeridas

- **Artillery**: Para load testing de WebSockets y HTTP
- **k6**: Para stress testing avanzado
- **Socket.IO Client**: Para pruebas personalizadas

### Instalación

```bash
# Instalar Artillery globalmente
npm install -g artillery

# Instalar k6 (Linux/Mac)
brew install k6
# O descargar desde https://k6.io/docs/getting-started/installation/

# Socket.IO Client ya está en las dependencias del proyecto
```

## Escenarios de Prueba

### 1. Load Test - Conexiones Concurrentes (Artillery)

Simula 1000 usuarios conectándose gradualmente al sistema.

```bash
# Ejecutar load test
artillery run load-test/load-test.yml

# Ver reporte
artillery run --output report.json load-test/load-test.yml
artillery report report.json
```

**Configuración**: `load-test.yml`
- Duración: 10 minutos
- Ramp-up: 100 usuarios/minuto hasta 1000
- Valida: latencia, tasa de errores, throughput

### 2. Stress Test - Pico de Tráfico (k6)

Simula un spike repentino de 5000 usuarios.

```bash
# Ejecutar stress test
k6 run stress-test/stress-test.js

# Con reporte detallado
k6 run --out json=stress-report.json stress-test/stress-test.js
```

**Objetivo**:
- Identificar punto de ruptura del sistema
- Medir degradación gradual vs colapso abrupto
- Validar recuperación después del pico

### 3. Endurance Test - Estabilidad a Largo Plazo

Prueba la estabilidad del sistema bajo carga constante durante 2 horas.

```bash
# Ejecutar endurance test
artillery run endurance-test/endurance-test.yml
```

**Objetivo**:
- Detectar memory leaks
- Detectar degradación progresiva
- Validar estabilidad de timers y reconexiones

### 4. Spike Test - Manejo de Eventos Simultáneos

Prueba 100 jugadores en una sala respondiendo simultáneamente.

```bash
# Ejecutar spike test personalizado
node spike-test/spike-test.js
```

**Objetivo**:
- Medir latencia p50, p95, p99
- Validar orden de procesamiento
- Ausencia de race conditions

## Métricas Objetivo

### API REST
- **Latencia (p50)**: ≤ 100ms
- **Latencia (p95)**: ≤ 200ms
- **Latencia (p99)**: ≤ 500ms
- **Throughput**: ≥ 500 requests/segundo por instancia
- **Tasa de error**: ≤ 0.1%

### WebSocket (Socket.IO)
- **Latencia de conexión**: ≤ 50ms
- **Latencia de eventos (p50)**: ≤ 50ms
- **Latencia de eventos (p95)**: ≤ 100ms
- **Latencia de eventos (p99)**: ≤ 300ms
- **Throughput**: ≥ 1000 eventos/segundo por instancia
- **Pérdida de mensajes**: 0%

### Sistema
- **Usuarios concurrentes**: ≥ 1000 (objetivo: 5000)
- **Salas concurrentes**: ≥ 100 (objetivo: 500)
- **CPU utilization**: ≤ 70%
- **Memoria utilization**: ≤ 80%
- **Disponibilidad**: ≥ 99.5%

## Estructura de Archivos

```
performance-tests/
├── README.md                    # Este archivo
├── load-test/
│   ├── load-test.yml           # Configuración Artillery para load test
│   └── scenarios.js            # Escenarios personalizados para Artillery
├── stress-test/
│   ├── stress-test.js          # Script k6 para stress test
│   └── config.js               # Configuración de stress test
├── endurance-test/
│   └── endurance-test.yml      # Configuración para endurance test
├── spike-test/
│   └── spike-test.js           # Script personalizado para spike test
└── utils/
    ├── socket-client.js        # Utilidades para cliente Socket.IO
    └── metrics-collector.js    # Recolector de métricas personalizadas
```

## Cómo Crear un Nuevo Test

### Artillery (YAML)

```yaml
config:
  target: "http://localhost:4000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
  plugins:
    expect: {}

scenarios:
  - name: "REST API Test"
    flow:
      - get:
          url: "/"
      - post:
          url: "/api/v1/auth/login"
          json:
            email: "test@example.com"
            password: "password123"
```

### k6 (JavaScript)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '5m', target: 1000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:4000/');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

## Análisis de Resultados

### Artillery

Los reportes de Artillery incluyen:
- Métricas de latencia (min, max, median, p95, p99)
- Tasa de requests por segundo
- Tasa de errores por código HTTP
- Distribución de duraciones

### k6

Los reportes de k6 incluyen:
- Checks (validaciones) pasadas/fallidas
- Métricas HTTP (duration, waiting, connecting)
- Data sent/received
- Iteraciones por VU (Virtual User)

## Recomendaciones

1. **Baseline**: Ejecutar tests en ambiente limpio sin carga para establecer baseline
2. **Incrementar gradualmente**: Aumentar carga progresivamente para identificar límites
3. **Monitorear recursos**: Usar Azure Monitor o similar para ver CPU/memoria durante tests
4. **Logs**: Revisar logs del servidor durante y después de los tests
5. **Repetir**: Ejecutar cada test al menos 3 veces para promediar resultados
6. **Ambiente realista**: Usar datos y escenarios que reflejen uso real de usuarios

## Troubleshooting

### Error: ECONNREFUSED
- Verificar que el servidor esté corriendo en el puerto especificado
- Verificar firewall y reglas de red

### Error: Too many open files
- Aumentar límite de file descriptors:
  ```bash
  ulimit -n 65536
  ```

### Alta latencia inesperada
- Verificar que no haya otros procesos consumiendo recursos
- Ejecutar tests desde una máquina dedicada
- Considerar latencia de red si el servidor es remoto

### Memory leaks detectados
- Usar `node --inspect` y Chrome DevTools para profiling
- Revisar listeners de eventos que no se removieron
- Verificar timers que no se limpiaron

## Referencias

- [Artillery Documentation](https://www.artillery.io/docs)
- [k6 Documentation](https://k6.io/docs/)
- [Socket.IO Load Testing](https://socket.io/docs/v4/load-testing/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
