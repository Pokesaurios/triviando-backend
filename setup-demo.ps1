# Security Demonstration Setup Script
# Run this script to prepare for the jury demonstration

Write-Host "`n" -NoNewline
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   🛡️  SECURITY DEMONSTRATION SETUP" -ForegroundColor Cyan
Write-Host "   Scenario 2: Prevention Against Common Attacks" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n"

# Check Node.js
Write-Host "🔍 Checking Node.js installation..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Node.js found: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check npm
Write-Host "`n🔍 Checking npm installation..." -ForegroundColor Yellow
$npmVersion = npm --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ npm found: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ npm not found. Please install npm first." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Dependencies installed successfully" -ForegroundColor Green

# Create audit directory
Write-Host "`n📁 Creating audit directory..." -ForegroundColor Yellow
if (-not (Test-Path "audit")) {
    New-Item -ItemType Directory -Path "audit" | Out-Null
    Write-Host "   ✅ Audit directory created" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Audit directory already exists" -ForegroundColor Gray
}

# Run security audit
Write-Host "`n🔍 Running security audit..." -ForegroundColor Yellow
npm run audit:security
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ⚠️  Security audit completed with warnings" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Security audit passed!" -ForegroundColor Green
}

# Check if HTML report was generated
Write-Host "`n📊 Checking reports..." -ForegroundColor Yellow
if (Test-Path "audit/security-audit.html") {
    Write-Host "   ✅ HTML report generated" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  HTML report not found" -ForegroundColor Yellow
}

if (Test-Path "audit/security-audit.json") {
    Write-Host "   ✅ JSON report generated" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  JSON report not found" -ForegroundColor Yellow
}

if (Test-Path "audit/security-audit.md") {
    Write-Host "   ✅ Markdown report generated" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Markdown report not found" -ForegroundColor Yellow
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   ✅ SETUP COMPLETE!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n"

Write-Host "📋 Next Steps for Jury Demonstration:" -ForegroundColor White
Write-Host "`n"
Write-Host "1. Run complete demo (recommended):" -ForegroundColor Yellow
Write-Host "   npm run demo:jury" -ForegroundColor Cyan
Write-Host "`n"
Write-Host "2. View HTML report:" -ForegroundColor Yellow
Write-Host "   start audit/security-audit.html" -ForegroundColor Cyan
Write-Host "`n"
Write-Host "3. Run security tests:" -ForegroundColor Yellow
Write-Host "   npm run test:security" -ForegroundColor Cyan
Write-Host "`n"
Write-Host "4. For more options, see:" -ForegroundColor Yellow
Write-Host "   docs/SECURITY-DEMO-README.md" -ForegroundColor Cyan
Write-Host "`n"

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n"

# Ask if user wants to open the report
$response = Read-Host "Would you like to open the HTML report now? (Y/N)"
if ($response -eq "Y" -or $response -eq "y") {
    if (Test-Path "audit/security-audit.html") {
        Write-Host "`n🌐 Opening HTML report in browser..." -ForegroundColor Yellow
        Start-Process "audit/security-audit.html"
    } else {
        Write-Host "`n⚠️  HTML report not found. Please run the audit first." -ForegroundColor Yellow
    }
}

Write-Host "`n✨ Ready for demonstration! Good luck!" -ForegroundColor Green
Write-Host "`n"
