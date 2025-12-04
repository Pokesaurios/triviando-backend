import fs from "fs";
import path from "path";

interface RouteInfo {
  file: string;
  method: string;
  path: string;
  protected: boolean;
  middlewares: string[];
}

interface AuditReport {
  timestamp: string;
  summary: {
    totalEndpoints: number;
    protectedEndpoints: number;
    unprotectedEndpoints: number;
    protectionRate: string;
  };
  endpoints: RouteInfo[];
  unprotectedEndpoints: RouteInfo[];
  socketProtection: {
    enabled: boolean;
    middleware: string;
  };
}

/**
 * Herramienta de auditoría de endpoints protegidos
 * Analiza todos los archivos de rutas y verifica que los endpoints
 * sensibles estén protegidos con middleware de autenticación
 */
class EndpointSecurityAuditor {
  private routesDir: string;
  private endpoints: RouteInfo[] = [];

  constructor() {
    this.routesDir = path.join(__dirname, "..", "src", "routes");
  }

  /**
   * Analiza un archivo de rutas para extraer información de endpoints
   */
  private analyzeRouteFile(filePath: string): RouteInfo[] {
    const content = fs.readFileSync(filePath, "utf-8");
    const routes: RouteInfo[] = [];
    const fileName = path.basename(filePath);

    // Detectar importación de authMiddleware
    const hasAuthImport = /import.*authMiddleware.*from/.test(content);

    // Patrones para detectar definiciones de rutas
    const routePatterns = [
      /router\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']\s*,\s*([^)]+)\)/g,
    ];

    routePatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        const middlewaresStr = match[3];

        // Detectar si tiene authMiddleware en la cadena
        const hasAuth = /authMiddleware/.test(middlewaresStr);
        const middlewares: string[] = [];

        if (hasAuth) middlewares.push("authMiddleware");
        if (/validateBody/.test(middlewaresStr)) middlewares.push("validateBody");
        if (/validateParams/.test(middlewaresStr)) middlewares.push("validateParams");

        routes.push({
          file: fileName,
          method,
          path: this.buildFullPath(fileName, routePath),
          protected: hasAuth,
          middlewares,
        });
      }
    });

    return routes;
  }

  /**
   * Construye la ruta completa basándose en el archivo
   */
  private buildFullPath(fileName: string, routePath: string): string {
    const baseMap: Record<string, string> = {
      "auth.routes.ts": "/api/v1/auth",
      "room.routes.ts": "/api/v1/rooms",
      "trivia.routes.ts": "/api/v1/trivia",
      "gameResult.routes.ts": "/api/v1/game-results",
    };

    const base = baseMap[fileName] || "/api/v1";
    return `${base}${routePath}`;
  }

  /**
   * Escanea todos los archivos de rutas
   */
  public scanAllRoutes(): void {
    const files = fs.readdirSync(this.routesDir);

    files.forEach((file) => {
      if (file.endsWith(".routes.ts")) {
        const filePath = path.join(this.routesDir, file);
        const routes = this.analyzeRouteFile(filePath);
        this.endpoints.push(...routes);
      }
    });
  }

  /**
   * Verifica si un endpoint debe estar protegido basándose en reglas de negocio
   */
  private shouldBeProtected(route: RouteInfo): boolean {
    // Rutas públicas permitidas
    const publicRoutes = [
      { method: "POST", path: "/api/v1/auth/register" },
      { method: "POST", path: "/api/v1/auth/login" },
    ];

    return !publicRoutes.some(
      (pub) => pub.method === route.method && pub.path === route.path
    );
  }

  /**
   * Genera el reporte de auditoría
   */
  public generateReport(): AuditReport {
    const protectedEndpoints = this.endpoints.filter((e) => e.protected);
    const unprotectedEndpoints = this.endpoints.filter((e) => !e.protected);

    // Verificar endpoints desprotegidos que deberían estar protegidos
    const criticalUnprotected = unprotectedEndpoints.filter((e) =>
      this.shouldBeProtected(e)
    );

    const protectionRate =
      this.endpoints.length > 0
        ? ((protectedEndpoints.length / this.endpoints.length) * 100).toFixed(2)
        : "0.00";

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalEndpoints: this.endpoints.length,
        protectedEndpoints: protectedEndpoints.length,
        unprotectedEndpoints: unprotectedEndpoints.length,
        protectionRate: `${protectionRate}%`,
      },
      endpoints: this.endpoints,
      unprotectedEndpoints: criticalUnprotected,
      socketProtection: {
        enabled: this.checkSocketProtection(),
        middleware: "socketAuthMiddleware",
      },
    };
  }

  /**
   * Verifica si Socket.IO tiene middleware de autenticación
   */
  private checkSocketProtection(): boolean {
    const socketServerPath = path.join(
      __dirname,
      "..",
      "src",
      "socket",
      "socketServer.ts"
    );

    if (!fs.existsSync(socketServerPath)) return false;

    const content = fs.readFileSync(socketServerPath, "utf-8");
    return /socketAuthMiddleware/.test(content);
  }

  /**
   * Imprime el reporte en consola con formato
   */
  public printReport(report: AuditReport): void {
    console.log("\n╔═══════════════════════════════════════════════════════════╗");
    console.log("║     REPORTE DE AUDITORÍA DE SEGURIDAD - AUTORIZACIÓN     ║");
    console.log("╚═══════════════════════════════════════════════════════════╝\n");

    console.log(`📅 Fecha: ${new Date(report.timestamp).toLocaleString()}\n`);

    console.log("📊 RESUMEN EJECUTIVO:");
    console.log("─────────────────────────────────────────────────────────────");
    console.log(`Total de endpoints REST:      ${report.summary.totalEndpoints}`);
    console.log(`Endpoints protegidos:         ${report.summary.protectedEndpoints} ✓`);
    console.log(`Endpoints sin protección:     ${report.summary.unprotectedEndpoints}`);
    console.log(`Tasa de protección:           ${report.summary.protectionRate}`);
    console.log(`Socket.IO protegido:          ${report.socketProtection.enabled ? "✓ SÍ" : "✗ NO"}\n`);

    if (report.summary.protectionRate === "100.00%") {
      console.log("✅ CUMPLIMIENTO: 100% de endpoints protegidos requeridos están seguros\n");
    } else {
      console.log("⚠️  ADVERTENCIA: Algunos endpoints carecen de protección\n");
    }

    console.log("🔒 DETALLE DE ENDPOINTS:");
    console.log("─────────────────────────────────────────────────────────────");

    // Agrupar por archivo
    const groupedByFile: Record<string, RouteInfo[]> = {};
    report.endpoints.forEach((endpoint) => {
      if (!groupedByFile[endpoint.file]) {
        groupedByFile[endpoint.file] = [];
      }
      groupedByFile[endpoint.file].push(endpoint);
    });

    Object.entries(groupedByFile).forEach(([file, routes]) => {
      console.log(`\n📄 ${file}`);
      routes.forEach((route) => {
        const icon = route.protected ? "🔒" : "🔓";
        const status = route.protected ? "[PROTEGIDO]" : "[PÚBLICO]";
        console.log(`   ${icon} ${status} ${route.method.padEnd(6)} ${route.path}`);
        if (route.middlewares.length > 0) {
          console.log(`      └─ Middlewares: ${route.middlewares.join(", ")}`);
        }
      });
    });

    if (report.unprotectedEndpoints.length > 0) {
      console.log("\n\n⚠️  ENDPOINTS DESPROTEGIDOS QUE REQUIEREN ATENCIÓN:");
      console.log("─────────────────────────────────────────────────────────────");
      report.unprotectedEndpoints.forEach((endpoint) => {
        console.log(`❌ ${endpoint.method} ${endpoint.path}`);
        console.log(`   Archivo: ${endpoint.file}`);
      });
    }

    console.log("\n\n🛡️  VERIFICACIÓN DE SOCKET.IO:");
    console.log("─────────────────────────────────────────────────────────────");
    if (report.socketProtection.enabled) {
      console.log(`✅ Middleware activo: ${report.socketProtection.middleware}`);
      console.log("   Todas las conexiones WebSocket requieren autenticación JWT");
    } else {
      console.log("❌ Socket.IO NO tiene middleware de autenticación");
    }

    console.log("\n" + "═".repeat(61));
    console.log("Reporte generado exitosamente");
    console.log("═".repeat(61) + "\n");
  }

  /**
   * Guarda el reporte en formato JSON
   */
  public saveReport(report: AuditReport, outputPath?: string): void {
    const defaultPath = path.join(__dirname, "..", "audit", "security-audit-report.json");
    const savePath = outputPath || defaultPath;

    // Crear directorio si no existe
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(savePath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Reporte guardado en: ${savePath}`);
  }
}

/**
 * Ejecutar auditoría
 */
function runAudit() {
  console.log("Iniciando auditoría de seguridad de endpoints...\n");

  const auditor = new EndpointSecurityAuditor();
  auditor.scanAllRoutes();
  const report = auditor.generateReport();

  auditor.printReport(report);
  auditor.saveReport(report);

  // Código de salida basado en resultado
  if (report.unprotectedEndpoints.length > 0) {
    console.log("⚠️  Auditoría completada con advertencias");
    process.exit(1);
  } else {
    console.log("✅ Auditoría completada exitosamente - Sistema seguro");
    process.exit(0);
  }
}

// Ejecutar si se invoca directamente
if (require.main === module) {
  runAudit();
}

export { EndpointSecurityAuditor, RouteInfo, AuditReport };
