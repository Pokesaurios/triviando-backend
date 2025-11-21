/**
 * k6 Stress Test for TrivIAndo Backend
 * 
 * Este script simula un spike de tráfico para identificar el punto de ruptura
 * del sistema y medir su capacidad de recuperación.
 * 
 * Ejecución:
 *   k6 run stress-test.js
 * 
 * Con reporte JSON:
 *   k6 run --out json=stress-report.json stress-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Métricas personalizadas
const loginErrors = new Counter('login_errors');
const roomCreationErrors = new Counter('room_creation_errors');
const successRate = new Rate('success_rate');
const customLatency = new Trend('custom_latency');

// Configuración del test
export const options = {
  stages: [
    // Calentamiento: incremento gradual a 100 usuarios en 1 minuto
    { duration: '1m', target: 100 },
    
    // Carga normal: mantener 100 usuarios durante 2 minutos
    { duration: '2m', target: 100 },
    
    // SPIKE: incremento abrupto a 5000 usuarios en 2 minutos
    { duration: '2m', target: 5000 },
    
    // Pico sostenido: mantener 5000 usuarios durante 5 minutos
    { duration: '5m', target: 5000 },
    
    // Descenso rápido: bajar a 100 usuarios en 2 minutos
    { duration: '2m', target: 100 },
    
    // Recuperación: mantener 100 usuarios durante 2 minutos
    { duration: '2m', target: 100 },
    
    // Enfriamiento: bajar a 0
    { duration: '1m', target: 0 },
  ],
  
  // Umbrales de aceptación
  thresholds: {
    // 95% de requests deben completarse en menos de 500ms
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    
    // Tasa de error debe ser menor al 1%
    http_req_failed: ['rate<0.01'],
    
    // Tasa de éxito debe ser mayor al 95%
    success_rate: ['rate>0.95'],
    
    // Latencia personalizada
    custom_latency: ['p(95)<200'],
  },
  
  // Limitar la tasa de requests si es necesario
  // rps: 1000,
};

// URL base del servidor
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// Datos de test
const testUser = {
  email: 'stresstest@example.com',
  password: 'StressTest123!',
};

/**
 * Setup: Se ejecuta una vez al inicio
 */
export function setup() {
  console.log('🚀 Iniciando Stress Test...');
  console.log(`Target: ${BASE_URL}`);
  
  // Verificar que el servidor está disponible
  const healthCheck = http.get(`${BASE_URL}/`);
  if (healthCheck.status !== 200) {
    throw new Error('Servidor no disponible');
  }
  
  return { startTime: Date.now() };
}

/**
 * Escenario principal: Se ejecuta para cada VU (Virtual User)
 */
export default function(data) {
  // Agrupar requests relacionadas
  group('Health Check', () => {
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}/`);
    const duration = Date.now() - startTime;
    
    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 200ms': () => duration < 200,
    });
    
    successRate.add(success);
    customLatency.add(duration);
  });
  
  sleep(1);
  
  group('User Authentication', () => {
    const startTime = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify(testUser),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const duration = Date.now() - startTime;
    
    const success = check(res, {
      'login successful': (r) => r.status === 200 || r.status === 201,
      'token received': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.token !== undefined;
        } catch (e) {
          return false;
        }
      },
    });
    
    if (!success) {
      loginErrors.add(1);
    }
    
    successRate.add(success);
    customLatency.add(duration);
    
    // Extraer token para requests subsecuentes (si login fue exitoso)
    if (res.status === 200 || res.status === 201) {
      try {
        const body = JSON.parse(res.body);
        return body.token;
      } catch (e) {
        return null;
      }
    }
  });
  
  sleep(2);
  
  group('List Rooms', () => {
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/rooms`);
    const duration = Date.now() - startTime;
    
    const success = check(res, {
      'rooms listed': (r) => r.status === 200,
      'response is array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) || Array.isArray(body.rooms);
        } catch (e) {
          return false;
        }
      },
    });
    
    successRate.add(success);
    customLatency.add(duration);
  });
  
  sleep(1);
}

/**
 * Teardown: Se ejecuta una vez al final
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Stress Test completado en ${duration} segundos`);
}

/**
 * Handle summary: Personalizar el reporte final
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    'stress-test-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n';
  summary += `${indent}📊 Resumen del Stress Test\n`;
  summary += `${indent}${'='.repeat(50)}\n\n`;
  
  // Métricas HTTP
  const httpReqs = data.metrics.http_reqs;
  const httpReqDuration = data.metrics.http_req_duration;
  const httpReqFailed = data.metrics.http_req_failed;
  
  summary += `${indent}Requests:\n`;
  summary += `${indent}  Total: ${httpReqs.values.count}\n`;
  summary += `${indent}  Rate: ${httpReqs.values.rate.toFixed(2)}/s\n\n`;
  
  summary += `${indent}Latencia:\n`;
  summary += `${indent}  Avg: ${httpReqDuration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}  Min: ${httpReqDuration.values.min.toFixed(2)}ms\n`;
  summary += `${indent}  Max: ${httpReqDuration.values.max.toFixed(2)}ms\n`;
  summary += `${indent}  p(50): ${httpReqDuration.values['p(50)'].toFixed(2)}ms\n`;
  summary += `${indent}  p(95): ${httpReqDuration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}  p(99): ${httpReqDuration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  summary += `${indent}Errores:\n`;
  summary += `${indent}  Failed: ${(httpReqFailed.values.rate * 100).toFixed(2)}%\n`;
  summary += `${indent}  Passed: ${((1 - httpReqFailed.values.rate) * 100).toFixed(2)}%\n\n`;
  
  summary += `${indent}${'='.repeat(50)}\n`;
  
  return summary;
}
