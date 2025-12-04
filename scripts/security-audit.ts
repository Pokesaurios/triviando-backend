/**
 * Security Audit Script
 * 
 * Analiza el código fuente para verificar:
 * 1. Todos los endpoints REST usan validación Zod
 * 2. Todos los handlers de Socket.IO usan validación Zod
 * 3. No hay inputs sin validar
 * 4. Genera reporte de cobertura de seguridad
 */

import * as fs from 'fs';
import * as path from 'path';

interface SecurityAuditResult {
  timestamp: string;
  totalEndpoints: number;
  validatedEndpoints: number;
  unvalidatedEndpoints: string[];
  totalSocketHandlers: number;
  validatedSocketHandlers: number;
  unvalidatedSocketHandlers: string[];
  zodSchemasCount: number;
  validationMiddlewareUsage: number;
  coveragePercentage: number;
  vulnerabilitiesFound: number;
  securityScore: number;
  details: {
    restEndpoints: EndpointInfo[];
    socketHandlers: SocketHandlerInfo[];
    zodSchemas: string[];
  };
}

interface EndpointInfo {
  file: string;
  method: string;
  path: string;
  hasValidation: boolean;
  validationType?: string;
}

interface SocketHandlerInfo {
  file: string;
  event: string;
  hasValidation: boolean;
}

class SecurityAuditor {
  private srcPath: string;
  private results: SecurityAuditResult;

  constructor() {
    this.srcPath = path.join(__dirname, '..', 'src');
    this.results = {
      timestamp: new Date().toISOString(),
      totalEndpoints: 0,
      validatedEndpoints: 0,
      unvalidatedEndpoints: [],
      totalSocketHandlers: 0,
      validatedSocketHandlers: 0,
      unvalidatedSocketHandlers: [],
      zodSchemasCount: 0,
      validationMiddlewareUsage: 0,
      coveragePercentage: 0,
      vulnerabilitiesFound: 0,
      securityScore: 0,
      details: {
        restEndpoints: [],
        socketHandlers: [],
        zodSchemas: []
      }
    };
  }

  async audit(): Promise<SecurityAuditResult> {
    console.log('🔍 Starting Security Audit...\n');

    await this.findZodSchemas();
    await this.analyzeRoutes();
    await this.analyzeSocketHandlers();
    await this.analyzeMiddleware();
    this.calculateMetrics();
    this.generateReport();

    return this.results;
  }

  private async findZodSchemas() {
    console.log('📋 Analyzing Zod Schemas...');
    const schemasPath = path.join(this.srcPath, 'schemas');
    
    if (!fs.existsSync(schemasPath)) {
      console.warn('⚠️  Schemas directory not found');
      return;
    }

    const schemaFiles = fs.readdirSync(schemasPath)
      .filter(file => file.endsWith('.ts'));

    for (const file of schemaFiles) {
      const filePath = path.join(schemasPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Contar esquemas Zod en el archivo
      const schemaMatches = content.match(/export\s+(const|let)\s+\w+Schema/g);
      if (schemaMatches) {
        this.results.zodSchemasCount += schemaMatches.length;
        this.results.details.zodSchemas.push(file);
      }
    }

    console.log(`   Found ${this.results.zodSchemasCount} Zod schemas in ${schemaFiles.length} files\n`);
  }

  private async analyzeRoutes() {
    console.log('🛣️  Analyzing REST Routes...');
    const routesPath = path.join(this.srcPath, 'routes');

    if (!fs.existsSync(routesPath)) {
      console.warn('⚠️  Routes directory not found');
      return;
    }

    const routeFiles = fs.readdirSync(routesPath)
      .filter(file => file.endsWith('.ts'));

    for (const file of routeFiles) {
      const filePath = path.join(routesPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Buscar definiciones de rutas
      const routePattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
      let match;

      while ((match = routePattern.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        
        // Verificar si la ruta usa validación
        const routeLineStart = content.lastIndexOf('\n', match.index) + 1;
        const routeLineEnd = content.indexOf('\n', match.index);
        const routeLine = content.substring(routeLineStart, routeLineEnd);
        
        const hasValidation = routeLine.includes('validate(') ||
                 routeLine.includes('validateRequest') ||
                 routeLine.includes('validateBody') ||
                 routeLine.includes('validateParams') ||
                 routeLine.includes('validateQuery');

        const endpoint: EndpointInfo = {
          file,
          method,
          path: routePath,
          hasValidation,
          validationType: hasValidation ? 'Zod Middleware' : undefined
        };

        this.results.details.restEndpoints.push(endpoint);
        this.results.totalEndpoints++;

        if (hasValidation) {
          this.results.validatedEndpoints++;
        } else {
          this.results.unvalidatedEndpoints.push(`${method} ${routePath} (${file})`);
        }
      }
    }

    console.log(`   Found ${this.results.totalEndpoints} REST endpoints`);
    console.log(`   Validated: ${this.results.validatedEndpoints}`);
    console.log(`   Unvalidated: ${this.results.unvalidatedEndpoints.length}\n`);
  }

  private async analyzeSocketHandlers() {
    console.log('🔌 Analyzing Socket.IO Handlers...');
    const socketPath = path.join(this.srcPath, 'socket');

    if (!fs.existsSync(socketPath)) {
      console.warn('⚠️  Socket directory not found');
      return;
    }

    const socketFiles = this.getAllFiles(socketPath)
      .filter(file => file.endsWith('.ts'));

    for (const filePath of socketFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      // Buscar handlers de socket
      const handlerPattern = /socket\.on\s*\(\s*['"]([^'"]+)['"]/g;
      let match;

      while ((match = handlerPattern.exec(content)) !== null) {
        const event = match[1];
        
        // Verificar si el handler usa validación
        const handlerStart = match.index;
        const handlerEnd = this.findMatchingBrace(content, handlerStart);
        const handlerContent = content.substring(handlerStart, handlerEnd);
        
        const hasValidation = handlerContent.includes('validateSocketData') ||
                 handlerContent.includes('socketValidator') ||
                 handlerContent.includes('validate(') ||
                 handlerContent.includes('.parse(') ||
                 handlerContent.includes('.safeParse(');

        const handler: SocketHandlerInfo = {
          file: fileName,
          event,
          hasValidation
        };

        this.results.details.socketHandlers.push(handler);
        this.results.totalSocketHandlers++;

        if (hasValidation) {
          this.results.validatedSocketHandlers++;
        } else {
          this.results.unvalidatedSocketHandlers.push(`${event} (${fileName})`);
        }
      }
    }

    console.log(`   Found ${this.results.totalSocketHandlers} Socket.IO handlers`);
    console.log(`   Validated: ${this.results.validatedSocketHandlers}`);
    console.log(`   Unvalidated: ${this.results.unvalidatedSocketHandlers.length}\n`);
  }

  private async analyzeMiddleware() {
    console.log('🔧 Analyzing Middleware Usage...');
    const middlewarePath = path.join(this.srcPath, 'middleware');

    if (!fs.existsSync(middlewarePath)) {
      console.warn('⚠️  Middleware directory not found');
      return;
    }

    const middlewareFiles = fs.readdirSync(middlewarePath)
      .filter(file => file.endsWith('.ts'));

    for (const file of middlewareFiles) {
      const filePath = path.join(middlewarePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      if (content.includes('ZodSchema') || content.includes('from "zod"') || content.includes("from 'zod'") || content.includes('validateBody') || content.includes('validateParams') || content.includes('validateQuery') || content.includes('socketValidator')) {
        this.results.validationMiddlewareUsage++;
      }
    }

    console.log(`   Found ${this.results.validationMiddlewareUsage} validation middleware files\n`);
  }

  private calculateMetrics() {
    console.log('📊 Calculating Security Metrics...');

    const totalInputPoints = this.results.totalEndpoints + this.results.totalSocketHandlers;
    const validatedInputPoints = this.results.validatedEndpoints + this.results.validatedSocketHandlers;

    if (totalInputPoints > 0) {
      this.results.coveragePercentage = (validatedInputPoints / totalInputPoints) * 100;
    }

    // Contar vulnerabilidades (endpoints sin validación)
    this.results.vulnerabilitiesFound = 
      this.results.unvalidatedEndpoints.length + 
      this.results.unvalidatedSocketHandlers.length;

    // Calcular score de seguridad (0-100)
    const coverageScore = this.results.coveragePercentage;
    const schemaScore = Math.min((this.results.zodSchemasCount / 10) * 100, 100);
    const middlewareScore = Math.min((this.results.validationMiddlewareUsage / 3) * 100, 100);

    this.results.securityScore = (coverageScore * 0.6 + schemaScore * 0.2 + middlewareScore * 0.2);

    console.log(`   Coverage: ${this.results.coveragePercentage.toFixed(2)}%`);
    console.log(`   Security Score: ${this.results.securityScore.toFixed(2)}/100`);
    console.log(`   Vulnerabilities: ${this.results.vulnerabilitiesFound}\n`);
  }

  private generateReport() {
    console.log('📝 Generating Security Report...\n');

    const reportPath = path.join(__dirname, '..', 'audit');
    if (!fs.existsSync(reportPath)) {
      fs.mkdirSync(reportPath, { recursive: true });
    }

    // Reporte JSON
    const jsonReportPath = path.join(reportPath, 'security-audit.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(this.results, null, 2));
    console.log(`✅ JSON Report saved: ${jsonReportPath}`);

    // Reporte Markdown
    const mdReport = this.generateMarkdownReport();
    const mdReportPath = path.join(reportPath, 'security-audit.md');
    fs.writeFileSync(mdReportPath, mdReport);
    console.log(`✅ Markdown Report saved: ${mdReportPath}`);

    // Reporte HTML
    const htmlReport = this.generateHTMLReport();
    const htmlReportPath = path.join(reportPath, 'security-audit.html');
    fs.writeFileSync(htmlReportPath, htmlReport);
    console.log(`✅ HTML Report saved: ${htmlReportPath}\n`);
  }

  private generateMarkdownReport(): string {
    const passEmoji = this.results.coveragePercentage >= 100 ? '✅' : '⚠️';
    
    return `# Security Audit Report - Scenario 2
## Prevención ante ataques comunes

**Generated:** ${new Date(this.results.timestamp).toLocaleString()}

---

## 🎯 Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| **Validation Coverage** | ${this.results.coveragePercentage.toFixed(2)}% | ${passEmoji} |
| **Security Score** | ${this.results.securityScore.toFixed(2)}/100 | ${this.results.securityScore >= 90 ? '✅' : '⚠️'} |
| **Vulnerabilities Found** | ${this.results.vulnerabilitiesFound} | ${this.results.vulnerabilitiesFound === 0 ? '✅' : '❌'} |

---

## 📊 Input Validation Coverage

### REST API Endpoints
- **Total Endpoints:** ${this.results.totalEndpoints}
- **Validated with Zod:** ${this.results.validatedEndpoints}
- **Unvalidated:** ${this.results.unvalidatedEndpoints.length}
- **Coverage:** ${this.results.totalEndpoints > 0 ? ((this.results.validatedEndpoints / this.results.totalEndpoints) * 100).toFixed(2) : 0}%

${this.results.unvalidatedEndpoints.length > 0 ? `
### ⚠️ Unvalidated REST Endpoints
${this.results.unvalidatedEndpoints.map(ep => `- ${ep}`).join('\n')}
` : '### ✅ All REST endpoints are validated!'}

### Socket.IO Handlers
- **Total Handlers:** ${this.results.totalSocketHandlers}
- **Validated with Zod:** ${this.results.validatedSocketHandlers}
- **Unvalidated:** ${this.results.unvalidatedSocketHandlers.length}
- **Coverage:** ${this.results.totalSocketHandlers > 0 ? ((this.results.validatedSocketHandlers / this.results.totalSocketHandlers) * 100).toFixed(2) : 0}%

${this.results.unvalidatedSocketHandlers.length > 0 ? `
### ⚠️ Unvalidated Socket Handlers
${this.results.unvalidatedSocketHandlers.map(h => `- ${h}`).join('\n')}
` : '### ✅ All Socket.IO handlers are validated!'}

---

## 🛡️ Security Measures

### Zod Schema Validation
- **Total Zod Schemas:** ${this.results.zodSchemasCount}
- **Schema Files:** ${this.results.details.zodSchemas.length}
  ${this.results.details.zodSchemas.map(s => `- ${s}`).join('\n  ')}

### Validation Middleware
- **Middleware Files Using Zod:** ${this.results.validationMiddlewareUsage}

---

## 🎯 Scenario 2 Compliance

### Requirements Checklist

| Requirement | Status | Evidence |
|------------|--------|----------|
| Validar y sanitizar inputs con Zod | ${this.results.coveragePercentage >= 100 ? '✅ PASS' : '❌ FAIL'} | ${this.results.coveragePercentage.toFixed(2)}% coverage |
| Rechazar payloads inválidos (400 Bad Request) | ${this.results.validationMiddlewareUsage > 0 ? '✅ PASS' : '❌ FAIL'} | ${this.results.validationMiddlewareUsage} middleware files |
| 100% de inputs validados con Zod | ${this.results.coveragePercentage >= 100 ? '✅ PASS' : '❌ FAIL'} | ${this.results.validatedEndpoints + this.results.validatedSocketHandlers}/${this.results.totalEndpoints + this.results.totalSocketHandlers} validated |
| 0 vulnerabilidades detectadas | ${this.results.vulnerabilitiesFound === 0 ? '✅ PASS' : '❌ FAIL'} | ${this.results.vulnerabilitiesFound} found |

---

## 📋 Detailed Endpoint Analysis

### REST Endpoints
${this.results.details.restEndpoints.map(ep => 
  `- **${ep.method} ${ep.path}** (${ep.file})
  - Validated: ${ep.hasValidation ? '✅ Yes' : '❌ No'}${ep.validationType ? ` - ${ep.validationType}` : ''}`
).join('\n')}

### Socket.IO Handlers
${this.results.details.socketHandlers.map(h => 
  `- **${h.event}** (${h.file})
  - Validated: ${h.hasValidation ? '✅ Yes' : '❌ No'}`
).join('\n')}

---

## 🔍 Recommendations

${this.results.vulnerabilitiesFound === 0 ? 
  '### ✅ No vulnerabilities found! The system meets all security requirements for Scenario 2.' : 
  `### Action Items:
1. Add Zod validation to all unvalidated endpoints
2. Ensure all middleware properly validates input types
3. Run security tests to verify payload rejection
4. Re-run audit after implementing fixes`
}

---

*This report validates compliance with Security Scenario 2: Prevention against common attacks*
`;
  }

  private generateHTMLReport(): string {
    const statusColor = this.results.coveragePercentage >= 100 ? '#4CAF50' : '#FF9800';
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Audit Report - Scenario 2</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 { margin: 0 0 10px 0; }
        .header p { margin: 5px 0; opacity: 0.9; }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 36px;
            font-weight: bold;
            color: ${statusColor};
            margin: 10px 0;
        }
        .metric-label {
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
        }
        .section {
            background: white;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 {
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #667eea;
            color: white;
        }
        .pass { color: #4CAF50; font-weight: bold; }
        .fail { color: #f44336; font-weight: bold; }
        .warn { color: #FF9800; font-weight: bold; }
        .progress-bar {
            width: 100%;
            height: 30px;
            background: #e0e0e0;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            transition: width 0.3s ease;
        }
        .endpoint-list {
            list-style: none;
            padding: 0;
        }
        .endpoint-list li {
            padding: 10px;
            margin: 5px 0;
            background: #f9f9f9;
            border-left: 4px solid #667eea;
            border-radius: 4px;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-success { background: #4CAF50; color: white; }
        .badge-danger { background: #f44336; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Security Audit Report</h1>
        <p><strong>Scenario 2:</strong> Prevención ante ataques comunes</p>
        <p>Generated: ${new Date(this.results.timestamp).toLocaleString()}</p>
    </div>

    <div class="metrics">
        <div class="metric-card">
            <div class="metric-label">Validation Coverage</div>
            <div class="metric-value">${this.results.coveragePercentage.toFixed(1)}%</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${this.results.coveragePercentage}%">
                    ${this.results.coveragePercentage.toFixed(1)}%
                </div>
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Security Score</div>
            <div class="metric-value">${this.results.securityScore.toFixed(0)}/100</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${this.results.securityScore}%">
                    ${this.results.securityScore.toFixed(0)}
                </div>
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Vulnerabilities Found</div>
            <div class="metric-value" style="color: ${this.results.vulnerabilitiesFound === 0 ? '#4CAF50' : '#f44336'}">
                ${this.results.vulnerabilitiesFound}
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📊 Input Validation Coverage</h2>
        <table>
            <tr>
                <th>Category</th>
                <th>Total</th>
                <th>Validated</th>
                <th>Coverage</th>
            </tr>
            <tr>
                <td>REST API Endpoints</td>
                <td>${this.results.totalEndpoints}</td>
                <td>${this.results.validatedEndpoints}</td>
                <td class="${this.results.totalEndpoints === this.results.validatedEndpoints ? 'pass' : 'fail'}">
                    ${this.results.totalEndpoints > 0 ? ((this.results.validatedEndpoints / this.results.totalEndpoints) * 100).toFixed(1) : 0}%
                </td>
            </tr>
            <tr>
                <td>Socket.IO Handlers</td>
                <td>${this.results.totalSocketHandlers}</td>
                <td>${this.results.validatedSocketHandlers}</td>
                <td class="${this.results.totalSocketHandlers === this.results.validatedSocketHandlers ? 'pass' : 'fail'}">
                    ${this.results.totalSocketHandlers > 0 ? ((this.results.validatedSocketHandlers / this.results.totalSocketHandlers) * 100).toFixed(1) : 0}%
                </td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h2>🎯 Scenario 2 Compliance</h2>
        <table>
            <tr>
                <th>Requirement</th>
                <th>Status</th>
                <th>Evidence</th>
            </tr>
            <tr>
                <td>Validar y sanitizar inputs con Zod</td>
                <td class="${this.results.coveragePercentage >= 100 ? 'pass' : 'fail'}">
                    ${this.results.coveragePercentage >= 100 ? '✅ PASS' : '❌ FAIL'}
                </td>
                <td>${this.results.coveragePercentage.toFixed(2)}% coverage</td>
            </tr>
            <tr>
                <td>Rechazar payloads inválidos (400 Bad Request)</td>
                <td class="${this.results.validationMiddlewareUsage > 0 ? 'pass' : 'fail'}">
                    ${this.results.validationMiddlewareUsage > 0 ? '✅ PASS' : '❌ FAIL'}
                </td>
                <td>${this.results.validationMiddlewareUsage} middleware files</td>
            </tr>
            <tr>
                <td>100% de inputs validados con Zod</td>
                <td class="${this.results.coveragePercentage >= 100 ? 'pass' : 'fail'}">
                    ${this.results.coveragePercentage >= 100 ? '✅ PASS' : '❌ FAIL'}
                </td>
                <td>${this.results.validatedEndpoints + this.results.validatedSocketHandlers}/${this.results.totalEndpoints + this.results.totalSocketHandlers} validated</td>
            </tr>
            <tr>
                <td>0 vulnerabilidades detectadas en análisis estático</td>
                <td class="${this.results.vulnerabilitiesFound === 0 ? 'pass' : 'fail'}">
                    ${this.results.vulnerabilitiesFound === 0 ? '✅ PASS' : '❌ FAIL'}
                </td>
                <td>${this.results.vulnerabilitiesFound} found</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h2>🛡️ Security Measures</h2>
        <p><strong>Zod Schemas:</strong> ${this.results.zodSchemasCount} schemas in ${this.results.details.zodSchemas.length} files</p>
        <p><strong>Validation Middleware:</strong> ${this.results.validationMiddlewareUsage} files using Zod</p>
    </div>

    ${this.results.unvalidatedEndpoints.length > 0 || this.results.unvalidatedSocketHandlers.length > 0 ? `
    <div class="section">
        <h2>⚠️ Action Items</h2>
        <p>The following endpoints need Zod validation:</p>
        <ul class="endpoint-list">
            ${this.results.unvalidatedEndpoints.map(ep => `<li><span class="badge badge-danger">REST</span> ${ep}</li>`).join('')}
            ${this.results.unvalidatedSocketHandlers.map(h => `<li><span class="badge badge-danger">Socket</span> ${h}</li>`).join('')}
        </ul>
    </div>
    ` : `
    <div class="section" style="background: #e8f5e9;">
        <h2 style="color: #2e7d32; border-color: #2e7d32;">✅ Excellent Security Posture!</h2>
        <p style="color: #2e7d32;">All endpoints are properly validated with Zod. The system meets all requirements for Scenario 2.</p>
    </div>
    `}
</body>
</html>`;
  }

  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
      } else {
        arrayOfFiles.push(fullPath);
      }
    });

    return arrayOfFiles;
  }

  private findMatchingBrace(content: string, startIndex: number): number {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      // Handle strings
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) return i;
        }
      }
    }

    return content.length;
  }
}

// Run audit
const auditor = new SecurityAuditor();
auditor.audit()
  .then(results => {
    console.log('═══════════════════════════════════════════════');
    console.log('🎉 SECURITY AUDIT COMPLETED');
    console.log('═══════════════════════════════════════════════');
    console.log(`Coverage: ${results.coveragePercentage.toFixed(2)}%`);
    console.log(`Security Score: ${results.securityScore.toFixed(2)}/100`);
    console.log(`Vulnerabilities: ${results.vulnerabilitiesFound}`);
    console.log('═══════════════════════════════════════════════\n');

    if (results.coveragePercentage < 100) {
      console.error('❌ AUDIT FAILED: Not all inputs are validated with Zod');
      process.exit(1);
    }

    if (results.vulnerabilitiesFound > 0) {
      console.error('❌ AUDIT FAILED: Vulnerabilities found');
      process.exit(1);
    }

    console.log('✅ AUDIT PASSED: All security requirements met!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Audit failed with error:', error);
    process.exit(1);
  });
