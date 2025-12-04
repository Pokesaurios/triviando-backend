import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, "..", ".env") });

/**
 * Generador de tokens JWT para testing y demostración
 * Permite crear tokens válidos, expirados, y con diferentes configuraciones
 */
class JWTTokenGenerator {
  private secret: string;

  constructor() {
    this.secret = process.env.JWT_SECRET || "demo-secret-key";
    
    if (!process.env.JWT_SECRET) {
      console.warn("⚠️  JWT_SECRET no encontrado en .env, usando valor por defecto");
    }
  }

  /**
   * Genera un token válido
   */
  public generateValidToken(userId: string = "demo-user-id", expiresIn: string = "3h"): string {
    const payload = {
      id: userId,
      name: "Usuario Demo",
      email: "demo@example.com",
    };

    const token = jwt.sign(payload, this.secret, { expiresIn });
    return token;
  }

  /**
   * Genera un token que ya está expirado
   */
  public generateExpiredToken(userId: string = "demo-user-id"): string {
    const payload = {
      id: userId,
      name: "Usuario Demo",
      email: "demo@example.com",
      iat: Math.floor(Date.now() / 1000) - (4 * 60 * 60), // Emitido hace 4 horas
      exp: Math.floor(Date.now() / 1000) - (1 * 60 * 60), // Expirado hace 1 hora
    };

    // Firmar sin opciones de expiración ya que las incluimos manualmente
    const token = jwt.sign(payload, this.secret);
    return token;
  }

  /**
   * Genera un token con firma inválida
   */
  public generateInvalidSignatureToken(userId: string = "demo-user-id"): string {
    const payload = {
      id: userId,
      name: "Usuario Demo",
      email: "demo@example.com",
    };

    // Usar un secreto diferente para crear firma inválida
    const wrongSecret = "wrong-secret-key-12345";
    const token = jwt.sign(payload, wrongSecret, { expiresIn: "3h" });
    return token;
  }

  /**
   * Genera un token que expirará pronto (útil para testing)
   */
  public generateSoonToExpireToken(userId: string = "demo-user-id", secondsUntilExpire: number = 30): string {
    const payload = {
      id: userId,
      name: "Usuario Demo",
      email: "demo@example.com",
    };

    const token = jwt.sign(payload, this.secret, { expiresIn: `${secondsUntilExpire}s` });
    return token;
  }

  /**
   * Verifica y decodifica un token
   */
  public verifyToken(token: string): any {
    try {
      const decoded = jwt.verify(token, this.secret);
      return { valid: true, payload: decoded };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  /**
   * Decodifica un token sin verificar (útil para inspección)
   */
  public decodeToken(token: string): any {
    return jwt.decode(token, { complete: true });
  }

  /**
   * Muestra información sobre un token
   */
  public inspectToken(token: string): void {
    console.log("\n🔍 INSPECCIÓN DE TOKEN");
    console.log("─".repeat(60));

    const decoded = this.decodeToken(token);
    
    if (!decoded) {
      console.log("❌ Token inválido o malformado");
      return;
    }

    console.log("\n📋 Header:");
    console.log(JSON.stringify(decoded.header, null, 2));

    console.log("\n📋 Payload:");
    console.log(JSON.stringify(decoded.payload, null, 2));

    if (decoded.payload.iat) {
      const issuedAt = new Date(decoded.payload.iat * 1000);
      console.log(`\n📅 Emitido: ${issuedAt.toLocaleString()}`);
    }

    if (decoded.payload.exp) {
      const expiresAt = new Date(decoded.payload.exp * 1000);
      const now = new Date();
      const isExpired = expiresAt < now;
      
      console.log(`📅 Expira: ${expiresAt.toLocaleString()}`);
      console.log(`⏱️  Estado: ${isExpired ? "❌ EXPIRADO" : "✅ VÁLIDO"}`);
      
      if (!isExpired) {
        const timeLeft = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
        console.log(`⏳ Tiempo restante: ${this.formatDuration(timeLeft)}`);
      }
    }

    console.log("\n🔐 Verificación con secret actual:");
    const verification = this.verifyToken(token);
    if (verification.valid) {
      console.log("✅ Token válido y firma correcta");
    } else {
      console.log(`❌ Error: ${verification.error}`);
    }

    console.log("─".repeat(60) + "\n");
  }

  /**
   * Formatea duración en segundos a formato legible
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(" ");
  }
}

/**
 * CLI para generar tokens
 */
function main() {
  const generator = new JWTTokenGenerator();
  
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║          GENERADOR DE TOKENS JWT - DEMO                  ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  switch (command) {
    case "valid":
      {
        const userId = args[1] || "demo-user-id";
        const token = generator.generateValidToken(userId);
        
        console.log("✅ Token válido generado (expira en 3h):\n");
        console.log(`Bearer ${token}`);
        console.log("\n📋 Para usar en HTTP requests:");
        console.log(`Authorization: Bearer ${token}`);
        
        generator.inspectToken(token);
      }
      break;

    case "expired":
      {
        const userId = args[1] || "demo-user-id";
        const token = generator.generateExpiredToken(userId);
        
        console.log("⏰ Token expirado generado:\n");
        console.log(`Bearer ${token}`);
        console.log("\n📋 Para usar en HTTP requests:");
        console.log(`Authorization: Bearer ${token}`);
        
        generator.inspectToken(token);
      }
      break;

    case "invalid":
      {
        const userId = args[1] || "demo-user-id";
        const token = generator.generateInvalidSignatureToken(userId);
        
        console.log("🔓 Token con firma inválida generado:\n");
        console.log(`Bearer ${token}`);
        console.log("\n📋 Para usar en HTTP requests:");
        console.log(`Authorization: Bearer ${token}`);
        
        generator.inspectToken(token);
      }
      break;

    case "soon":
      {
        const userId = args[1] || "demo-user-id";
        const seconds = parseInt(args[2]) || 30;
        const token = generator.generateSoonToExpireToken(userId, seconds);
        
        console.log(`⏳ Token que expirará en ${seconds} segundos:\n`);
        console.log(`Bearer ${token}`);
        console.log("\n📋 Para usar en HTTP requests:");
        console.log(`Authorization: Bearer ${token}`);
        
        generator.inspectToken(token);
      }
      break;

    case "inspect":
      {
        const token = args[1];
        if (!token) {
          console.log("❌ Error: Debes proporcionar un token para inspeccionar");
          console.log("\nUso: npm run generate:token inspect <TOKEN>");
          break;
        }
        
        // Remover "Bearer " si está presente
        const cleanToken = token.replace(/^Bearer\s+/i, "");
        generator.inspectToken(cleanToken);
      }
      break;

    case "all":
      {
        console.log("🎯 Generando todos los tipos de tokens para demostración:\n");
        
        console.log("1️⃣  TOKEN VÁLIDO (3h):");
        const valid = generator.generateValidToken();
        console.log(`   Bearer ${valid}\n`);
        
        console.log("2️⃣  TOKEN EXPIRADO:");
        const expired = generator.generateExpiredToken();
        console.log(`   Bearer ${expired}\n`);
        
        console.log("3️⃣  TOKEN CON FIRMA INVÁLIDA:");
        const invalid = generator.generateInvalidSignatureToken();
        console.log(`   Bearer ${invalid}\n`);
        
        console.log("4️⃣  TOKEN QUE EXPIRA EN 30s:");
        const soon = generator.generateSoonToExpireToken();
        console.log(`   Bearer ${soon}\n`);

        console.log("\n💾 Copia estos tokens para usar en demo/authorization-demo.http");
        console.log("─".repeat(60) + "\n");
      }
      break;

    case "help":
    default:
      console.log("📖 USO:\n");
      console.log("  npm run generate:token <comando> [opciones]\n");
      console.log("COMANDOS:\n");
      console.log("  valid [userId]           Genera token válido (expira en 3h)");
      console.log("  expired [userId]         Genera token expirado");
      console.log("  invalid [userId]         Genera token con firma inválida");
      console.log("  soon [userId] [seconds]  Genera token que expirará pronto");
      console.log("  inspect <token>          Inspecciona y verifica un token");
      console.log("  all                      Genera todos los tipos de tokens");
      console.log("  help                     Muestra esta ayuda\n");
      console.log("EJEMPLOS:\n");
      console.log("  npm run generate:token valid");
      console.log("  npm run generate:token expired user123");
      console.log("  npm run generate:token soon user123 60");
      console.log("  npm run generate:token inspect eyJhbGc...");
      console.log("  npm run generate:token all\n");
      break;
  }
}

// Ejecutar si se invoca directamente
if (require.main === module) {
  main();
}

export { JWTTokenGenerator };
