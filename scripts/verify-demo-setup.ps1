# Script de verificación pre-demostración
# Verifica que todos los requisitos estén cumplidos antes de la presentación

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    VERIFICACIÓN PRE-DEMOSTRACIÓN - ESCENARIO AUTORIZACIÓN ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$script:allChecksPass = $true
$script:warningsCount = 0

function Test-Check {
    param(
        [string]$Name,
        [scriptblock]$Check,
        [string]$SuccessMessage,
        [string]$FailureMessage,
        [bool]$Critical = $true
    )
    
    Write-Host "Verificando: $Name..." -NoNewline
    
    try {
        $result = & $Check
        if ($result) {
            Write-Host " ✅" -ForegroundColor Green
            if ($SuccessMessage) {
                Write-Host "  └─ $SuccessMessage" -ForegroundColor Gray
            }
        } else {
            if ($Critical) {
                Write-Host " ❌" -ForegroundColor Red
                Write-Host "  └─ $FailureMessage" -ForegroundColor Red
                $script:allChecksPass = $false
            } else {
                Write-Host " ⚠️" -ForegroundColor Yellow
                Write-Host "  └─ $FailureMessage" -ForegroundColor Yellow
                $script:warningsCount++
            }
        }
    } catch {
        if ($Critical) {
            Write-Host " ❌" -ForegroundColor Red
            Write-Host "  └─ Error: $($_.Exception.Message)" -ForegroundColor Red
            $script:allChecksPass = $false
        } else {
            Write-Host " ⚠️" -ForegroundColor Yellow
            Write-Host "  └─ Error: $($_.Exception.Message)" -ForegroundColor Yellow
            $script:warningsCount++
        }
    }
}

Write-Host "📋 VERIFICACIÓN DE ARCHIVOS DE DEMO`n" -ForegroundColor Yellow

Test-Check "Archivo de requests HTTP" {
    Test-Path "demo/authorization-demo.http"
} "demo/authorization-demo.http existe" "Archivo demo/authorization-demo.http no encontrado"

Test-Check "README de demo completo" {
    Test-Path "demo/AUTHORIZATION_DEMO_README.md"
} "Documentación completa disponible" "demo/AUTHORIZATION_DEMO_README.md no encontrado"

Test-Check "Guía rápida" {
    Test-Path "demo/QUICK_START.md"
} "Guía rápida disponible" "demo/QUICK_START.md no encontrado"

Test-Check "Checklist de presentación" {
    Test-Path "demo/PRESENTATION_CHECKLIST.md"
} "Checklist disponible" "demo/PRESENTATION_CHECKLIST.md no encontrado"

Write-Host "`n🔧 VERIFICACIÓN DE SCRIPTS`n" -ForegroundColor Yellow

Test-Check "Script de auditoría" {
    Test-Path "scripts/audit-endpoints.ts"
} "audit-endpoints.ts disponible" "scripts/audit-endpoints.ts no encontrado"

Test-Check "Script de monitor" {
    Test-Path "scripts/monitor-security-logs.ts"
} "monitor-security-logs.ts disponible" "scripts/monitor-security-logs.ts no encontrado"

Test-Check "Script generador de tokens" {
    Test-Path "scripts/generate-tokens.ts"
} "generate-tokens.ts disponible" "scripts/generate-tokens.ts no encontrado"

Test-Check "Script de demo automatizada" {
    Test-Path "scripts/run-authorization-demo.ts"
} "run-authorization-demo.ts disponible" "scripts/run-authorization-demo.ts no encontrado"

Write-Host "`n📦 VERIFICACIÓN DE PACKAGE.JSON`n" -ForegroundColor Yellow

Test-Check "Comando audit:endpoints" {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $null -ne $packageJson.scripts.'audit:endpoints'
} "npm run audit:endpoints configurado" "Comando audit:endpoints no encontrado en package.json"

Test-Check "Comando monitor:security" {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $null -ne $packageJson.scripts.'monitor:security'
} "npm run monitor:security configurado" "Comando monitor:security no encontrado"

Test-Check "Comando generate:token" {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $null -ne $packageJson.scripts.'generate:token'
} "npm run generate:token configurado" "Comando generate:token no encontrado"

Test-Check "Comando demo:auth" {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $null -ne $packageJson.scripts.'demo:auth'
} "npm run demo:auth configurado" "Comando demo:auth no encontrado"

Write-Host "`n🔐 VERIFICACIÓN DE CÓDIGO DE SEGURIDAD`n" -ForegroundColor Yellow

Test-Check "Middleware de autenticación REST" {
    Test-Path "src/middleware/auth.middleware.ts"
} "authMiddleware implementado" "auth.middleware.ts no encontrado"

Test-Check "Middleware de autenticación Socket.IO" {
    Test-Path "src/middleware/socketAuth.ts"
} "socketAuthMiddleware implementado" "socketAuth.ts no encontrado"

Write-Host "`n✅ VERIFICACIÓN DE TESTS`n" -ForegroundColor Yellow

Test-Check "Tests de autorización HTTP" {
    Test-Path "tests/authorization.http.test.ts"
} "authorization.http.test.ts existe" "tests/authorization.http.test.ts no encontrado"

Test-Check "Tests de Socket.IO auth" {
    Test-Path "tests/socketAuthMiddleware.test.ts"
} "socketAuthMiddleware.test.ts existe" "tests/socketAuthMiddleware.test.ts no encontrado"

Write-Host "`n⚙️  VERIFICACIÓN DE CONFIGURACIÓN`n" -ForegroundColor Yellow

Test-Check "Archivo .env" {
    Test-Path ".env"
} ".env configurado" ".env no encontrado - Copia .env.example" $false

if (Test-Path ".env") {
    Test-Check "JWT_SECRET configurado" {
        $envContent = Get-Content ".env" -Raw
        $envContent -match "JWT_SECRET\s*="
    } "JWT_SECRET presente en .env" "JWT_SECRET no configurado en .env"
    
    Test-Check "MONGO_URI configurado" {
        $envContent = Get-Content ".env" -Raw
        $envContent -match "MONGO_URI\s*="
    } "MONGO_URI presente en .env" "MONGO_URI no configurado" $false
}

Write-Host "`n📁 VERIFICACIÓN DE ESTRUCTURA`n" -ForegroundColor Yellow

Test-Check "Carpeta demo/" {
    Test-Path "demo" -PathType Container
} "Carpeta demo existe" "Carpeta demo no encontrada"

Test-Check "Carpeta scripts/" {
    Test-Path "scripts" -PathType Container
} "Carpeta scripts existe" "Carpeta scripts no encontrada"

Test-Check "Carpeta audit/ (se creará al ejecutar)" {
    if (Test-Path "audit") { $true } else { $true }
} "Carpeta audit lista (o se creará)" "" $false

Write-Host "`n🌐 VERIFICACIÓN DE SERVICIOS (Opcional)`n" -ForegroundColor Yellow

Test-Check "Node.js instalado" {
    $null -ne (Get-Command node -ErrorAction SilentlyContinue)
} "Node.js disponible: $(node --version)" "Node.js no encontrado" $false

Test-Check "npm instalado" {
    $null -ne (Get-Command npm -ErrorAction SilentlyContinue)
} "npm disponible: $(npm --version)" "npm no encontrado" $false

Test-Check "Dependencies instaladas" {
    Test-Path "node_modules"
} "node_modules existe" "Ejecuta: npm install" $false

# Test MongoDB connection (opcional, no bloquea)
Write-Host "Verificando MongoDB..." -NoNewline
try {
    $mongoProcess = Get-Process mongod -ErrorAction SilentlyContinue
    if ($mongoProcess) {
        Write-Host " ✅" -ForegroundColor Green
        Write-Host "  └─ MongoDB corriendo (PID: $($mongoProcess.Id))" -ForegroundColor Gray
    } else {
        Write-Host " ⚠️" -ForegroundColor Yellow
        Write-Host "  └─ MongoDB no detectado (puede estar corriendo como servicio)" -ForegroundColor Yellow
        $script:warningsCount++
    }
} catch {
    Write-Host " ⚠️" -ForegroundColor Yellow
    Write-Host "  └─ No se pudo verificar MongoDB" -ForegroundColor Yellow
    $script:warningsCount++
}

# Test servidor corriendo (opcional)
Write-Host "Verificando servidor..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/auth/login" -Method POST `
        -ContentType "application/json" -Body '{"email":"test","password":"test"}' `
        -TimeoutSec 2 -ErrorAction Stop
    Write-Host " ✅" -ForegroundColor Green
    Write-Host "  └─ Servidor corriendo en http://localhost:3000" -ForegroundColor Gray
} catch {
    if ($_.Exception.Message -match "401|400|404") {
        Write-Host " ✅" -ForegroundColor Green
        Write-Host "  └─ Servidor corriendo (responde en puerto 3000)" -ForegroundColor Gray
    } else {
        Write-Host " ⚠️" -ForegroundColor Yellow
        Write-Host "  └─ Servidor no detectado. Ejecuta: npm run dev" -ForegroundColor Yellow
        $script:warningsCount++
    }
}

# Resumen final
Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    RESUMEN DE VERIFICACIÓN                 ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

if ($script:allChecksPass) {
    Write-Host "✅ TODAS LAS VERIFICACIONES CRÍTICAS PASARON" -ForegroundColor Green
    
    if ($script:warningsCount -gt 0) {
        Write-Host "⚠️  $($script:warningsCount) advertencias encontradas (no críticas)" -ForegroundColor Yellow
    }
    
    Write-Host "`n🎯 SISTEMA LISTO PARA LA DEMOSTRACIÓN`n" -ForegroundColor Green
    Write-Host "Próximos pasos:" -ForegroundColor Cyan
    Write-Host "  1. Asegúrate de que el servidor esté corriendo: npm run dev"
    Write-Host "  2. Ejecuta la demo automatizada: npm run demo:auth"
    Write-Host "  3. O sigue la guía en: demo/QUICK_START.md`n"
    
    exit 0
} else {
    Write-Host "❌ ALGUNAS VERIFICACIONES CRÍTICAS FALLARON" -ForegroundColor Red
    Write-Host "`nRevisa los errores anteriores antes de la presentación.`n" -ForegroundColor Yellow
    
    Write-Host "Soluciones comunes:" -ForegroundColor Cyan
    Write-Host "  • Archivos faltantes: Verifica que se hayan creado todos los scripts"
    Write-Host "  • .env no configurado: Copia .env.example y configura las variables"
    Write-Host "  • MongoDB: Inicia MongoDB o verifica la conexión`n"
    
    exit 1
}
