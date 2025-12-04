import fs from "fs";
import path from "path";
import { spawn, ChildProcess } from "child_process";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  ip?: string;
  path?: string;
  userId?: string;
  socketId?: string;
  err?: string;
}

interface SecurityMetrics {
  totalAttempts: number;
  failedAttempts: number;
  successfulAttempts: number;
  unauthorizedAttempts: number; // 401
  forbiddenAttempts: number; // 403
  uniqueIPs: Set<string>;
  failureReasons: Map<string, number>;
}

/**
 * Monitor de seguridad en tiempo real
 * Analiza logs del servidor para detectar intentos de acceso no autorizados
 */
class SecurityLogMonitor {
  private logFilePath: string;
  private metrics: SecurityMetrics;
  private recentLogs: LogEntry[] = [];
  private maxRecentLogs = 50;
  private logProcess?: ChildProcess;

  constructor(logFilePath?: string) {
    // Buscar archivo de log más reciente o usar el especificado
    this.logFilePath =
      logFilePath || this.findMostRecentLogFile() || "logs/app.log";
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): SecurityMetrics {
    return {
      totalAttempts: 0,
      failedAttempts: 0,
      successfulAttempts: 0,
      unauthorizedAttempts: 0,
      forbiddenAttempts: 0,
      uniqueIPs: new Set<string>(),
      failureReasons: new Map<string, number>(),
    };
  }

  /**
   * Encuentra el archivo de log más reciente
   */
  private findMostRecentLogFile(): string | null {
    const logsDir = path.join(__dirname, "..", "logs");
    if (!fs.existsSync(logsDir)) {
      return null;
    }

    const files = fs
      .readdirSync(logsDir)
      .filter((f) => f.endsWith(".log"))
      .map((f) => ({
        name: f,
        path: path.join(logsDir, f),
        time: fs.statSync(path.join(logsDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    return files.length > 0 ? files[0].path : null;
  }

  /**
   * Parsea una línea de log en formato JSON
   */
  private parseLogLine(line: string): LogEntry | null {
    try {
      // Los logs de pino son JSON por línea
      const parsed = JSON.parse(line);
      return {
        timestamp: parsed.time ? new Date(parsed.time).toISOString() : new Date().toISOString(),
        level: parsed.level === 30 ? "info" : parsed.level === 40 ? "warn" : parsed.level === 50 ? "error" : "debug",
        message: parsed.msg || "",
        ip: parsed.ip,
        path: parsed.path,
        userId: parsed.userId,
        socketId: parsed.socketId,
        err: parsed.err,
      };
    } catch {
      // Si no es JSON, intentar parsear formato de texto
      return this.parseTextLog(line);
    }
  }

  /**
   * Parsea logs en formato de texto plano
   */
  private parseTextLog(line: string): LogEntry | null {
    // Formato aproximado: [timestamp] LEVEL: message
    const match = line.match(/\[([^\]]+)\]\s+(\w+):\s+(.+)/);
    if (match) {
      return {
        timestamp: match[1],
        level: match[2].toLowerCase(),
        message: match[3],
      };
    }
    return null;
  }

  /**
   * Analiza una entrada de log y actualiza métricas
   */
  private analyzeLogEntry(entry: LogEntry): void {
    // Detectar intentos de autenticación
    const authRelated =
      entry.message.includes("Token") ||
      entry.message.includes("Authentication") ||
      entry.message.includes("Authorization") ||
      entry.message.includes("authenticated") ||
      entry.message.includes("Unauthorized") ||
      entry.message.includes("Forbidden");

    if (!authRelated) return;

    this.metrics.totalAttempts++;

    // Agregar a logs recientes
    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > this.maxRecentLogs) {
      this.recentLogs.pop();
    }

    // Rastrear IP
    if (entry.ip) {
      this.metrics.uniqueIPs.add(entry.ip);
    }

    // Analizar tipo de fallo
    if (entry.level === "warn" || entry.level === "error") {
      this.metrics.failedAttempts++;

      // Clasificar razón del fallo
      if (entry.message.includes("Token not provided") || entry.message.includes("Missing")) {
        this.incrementFailureReason("Token no proporcionado");
        this.metrics.unauthorizedAttempts++;
      } else if (entry.message.includes("Token invalid") || entry.message.includes("invalid")) {
        this.incrementFailureReason("Token inválido");
        this.metrics.unauthorizedAttempts++;
      } else if (entry.message.includes("expired")) {
        this.incrementFailureReason("Token expirado");
        this.metrics.unauthorizedAttempts++;
      } else if (entry.message.includes("not authorized") || entry.message.includes("Forbidden")) {
        this.incrementFailureReason("Sin permisos (403)");
        this.metrics.forbiddenAttempts++;
      } else if (entry.message.includes("User not found")) {
        this.incrementFailureReason("Usuario no encontrado");
        this.metrics.unauthorizedAttempts++;
      } else {
        this.incrementFailureReason("Otro error de autenticación");
      }
    } else {
      this.metrics.successfulAttempts++;
    }
  }

  private incrementFailureReason(reason: string): void {
    const current = this.metrics.failureReasons.get(reason) || 0;
    this.metrics.failureReasons.set(reason, current + 1);
  }

  /**
   * Lee el archivo de log existente
   */
  public analyzeExistingLogs(): void {
    if (!fs.existsSync(this.logFilePath)) {
      console.log(`⚠️  Archivo de log no encontrado: ${this.logFilePath}`);
      return;
    }

    console.log(`📖 Analizando logs existentes: ${this.logFilePath}\n`);

    const content = fs.readFileSync(this.logFilePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    lines.forEach((line) => {
      const entry = this.parseLogLine(line);
      if (entry) {
        this.analyzeLogEntry(entry);
      }
    });
  }

  /**
   * Monitorea el archivo de log en tiempo real
   */
  public startRealtimeMonitoring(): void {
    if (!fs.existsSync(this.logFilePath)) {
      console.log(`⚠️  Archivo de log no encontrado: ${this.logFilePath}`);
      console.log("Esperando a que se cree el archivo...\n");
    }

    console.log("🔍 Iniciando monitoreo en tiempo real...");
    console.log(`📂 Archivo: ${this.logFilePath}`);
    console.log("Presiona Ctrl+C para detener\n");

    // Usar tail -f en Unix o Get-Content en Windows
    const isWindows = process.platform === "win32";

    if (isWindows) {
      // PowerShell Get-Content con -Wait
      this.logProcess = spawn("powershell.exe", [
        "-Command",
        `Get-Content -Path "${this.logFilePath}" -Wait -Tail 10`,
      ]);
    } else {
      // tail -f en Unix
      this.logProcess = spawn("tail", ["-f", this.logFilePath]);
    }

    this.logProcess.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter((l) => l.trim());
      lines.forEach((line) => {
        const entry = this.parseLogLine(line);
        if (entry) {
          this.analyzeLogEntry(entry);
          this.displayRealtimeAlert(entry);
        }
      });
    });

    this.logProcess.stderr?.on("data", (data: Buffer) => {
      console.error(`Error del monitor: ${data.toString()}`);
    });

    this.logProcess.on("close", (code: number) => {
      console.log(`\nMonitor detenido (código: ${code})`);
    });

    // Mostrar dashboard inicial
    this.displayDashboard();

    // Actualizar dashboard cada 5 segundos
    setInterval(() => {
      this.displayDashboard();
    }, 5000);
  }

  /**
   * Muestra alerta en tiempo real para eventos de seguridad
   */
  private displayRealtimeAlert(entry: LogEntry): void {
    if (entry.level === "warn" || entry.level === "error") {
      const icon = entry.level === "error" ? "🚨" : "⚠️";
      console.log(
        `\n${icon} [${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`
      );
      if (entry.ip) console.log(`   └─ IP: ${entry.ip}`);
      if (entry.path) console.log(`   └─ Path: ${entry.path}`);
      if (entry.userId) console.log(`   └─ User ID: ${entry.userId}`);
    }
  }

  /**
   * Muestra dashboard con métricas actuales
   */
  public displayDashboard(): void {
    // Limpiar consola (opcional)
    // console.clear();

    console.log("\n╔═══════════════════════════════════════════════════════════╗");
    console.log("║         DASHBOARD DE SEGURIDAD - TIEMPO REAL              ║");
    console.log("╚═══════════════════════════════════════════════════════════╝\n");

    console.log(`📊 MÉTRICAS DE AUTENTICACIÓN/AUTORIZACIÓN:`);
    console.log("─────────────────────────────────────────────────────────────");
    console.log(`Total intentos:              ${this.metrics.totalAttempts}`);
    console.log(`✅ Exitosos:                 ${this.metrics.successfulAttempts}`);
    console.log(`❌ Fallidos:                 ${this.metrics.failedAttempts}`);
    console.log(`🚫 No autorizados (401):     ${this.metrics.unauthorizedAttempts}`);
    console.log(`🛑 Prohibidos (403):         ${this.metrics.forbiddenAttempts}`);
    console.log(`🌐 IPs únicas:               ${this.metrics.uniqueIPs.size}\n`);

    if (this.metrics.failureReasons.size > 0) {
      console.log("📋 RAZONES DE FALLO:");
      console.log("─────────────────────────────────────────────────────────────");
      Array.from(this.metrics.failureReasons.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([reason, count]) => {
          console.log(`   • ${reason}: ${count}`);
        });
      console.log();
    }

    if (this.recentLogs.length > 0) {
      console.log("📝 ÚLTIMOS EVENTOS DE SEGURIDAD (máx. 5):");
      console.log("─────────────────────────────────────────────────────────────");
      this.recentLogs.slice(0, 5).forEach((log) => {
        const icon = log.level === "error" ? "🔴" : log.level === "warn" ? "🟡" : "🟢";
        console.log(`${icon} [${log.timestamp}]`);
        console.log(`   ${log.message.substring(0, 80)}...`);
        if (log.ip) console.log(`   IP: ${log.ip}`);
      });
      console.log();
    }

    console.log("═".repeat(61) + "\n");
  }

  /**
   * Genera reporte final
   */
  public generateReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: {
        totalAttempts: this.metrics.totalAttempts,
        failedAttempts: this.metrics.failedAttempts,
        successfulAttempts: this.metrics.successfulAttempts,
        unauthorizedAttempts: this.metrics.unauthorizedAttempts,
        forbiddenAttempts: this.metrics.forbiddenAttempts,
        uniqueIPs: Array.from(this.metrics.uniqueIPs),
        failureReasons: Array.from(this.metrics.failureReasons.entries()),
      },
      recentLogs: this.recentLogs.slice(0, 20),
    };

    const reportPath = path.join(
      __dirname,
      "..",
      "audit",
      "security-logs-report.json"
    );

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`💾 Reporte de logs guardado en: ${reportPath}`);
  }

  /**
   * Detiene el monitoreo
   */
  public stop(): void {
    if (this.logProcess) {
      this.logProcess.kill();
    }
  }
}

/**
 * Ejecutar monitor
 */
function runMonitor() {
  const monitor = new SecurityLogMonitor();

  // Analizar logs existentes primero
  monitor.analyzeExistingLogs();
  monitor.displayDashboard();

  // Iniciar monitoreo en tiempo real
  monitor.startRealtimeMonitoring();

  // Manejar señales de cierre
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Deteniendo monitor...");
    monitor.displayDashboard();
    monitor.generateReport();
    monitor.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    monitor.stop();
    process.exit(0);
  });
}

// Ejecutar si se invoca directamente
if (require.main === module) {
  runMonitor();
}

export { SecurityLogMonitor, LogEntry, SecurityMetrics };
