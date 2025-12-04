#!/bin/bash

# Security Demonstration Setup Script
# Run this script to prepare for the jury demonstration

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   🛡️  SECURITY DEMONSTRATION SETUP${NC}"
echo -e "${CYAN}   Scenario 2: Prevention Against Common Attacks${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

# Check Node.js
echo -e "${YELLOW}🔍 Checking Node.js installation...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}   ✅ Node.js found: $NODE_VERSION${NC}"
else
    echo -e "${RED}   ❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

# Check npm
echo ""
echo -e "${YELLOW}🔍 Checking npm installation...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}   ✅ npm found: $NPM_VERSION${NC}"
else
    echo -e "${RED}   ❌ npm not found. Please install npm first.${NC}"
    exit 1
fi

# Install dependencies
echo ""
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
if npm install; then
    echo -e "${GREEN}   ✅ Dependencies installed successfully${NC}"
else
    echo -e "${RED}   ❌ Failed to install dependencies${NC}"
    exit 1
fi

# Create audit directory
echo ""
echo -e "${YELLOW}📁 Creating audit directory...${NC}"
if [ ! -d "audit" ]; then
    mkdir -p audit
    echo -e "${GREEN}   ✅ Audit directory created${NC}"
else
    echo -e "${GRAY}   ℹ️  Audit directory already exists${NC}"
fi

# Run security audit
echo ""
echo -e "${YELLOW}🔍 Running security audit...${NC}"
if npm run audit:security; then
    echo -e "${GREEN}   ✅ Security audit passed!${NC}"
else
    echo -e "${YELLOW}   ⚠️  Security audit completed with warnings${NC}"
fi

# Check if reports were generated
echo ""
echo -e "${YELLOW}📊 Checking reports...${NC}"
if [ -f "audit/security-audit.html" ]; then
    echo -e "${GREEN}   ✅ HTML report generated${NC}"
else
    echo -e "${YELLOW}   ⚠️  HTML report not found${NC}"
fi

if [ -f "audit/security-audit.json" ]; then
    echo -e "${GREEN}   ✅ JSON report generated${NC}"
else
    echo -e "${YELLOW}   ⚠️  JSON report not found${NC}"
fi

if [ -f "audit/security-audit.md" ]; then
    echo -e "${GREEN}   ✅ Markdown report generated${NC}"
else
    echo -e "${YELLOW}   ⚠️  Markdown report not found${NC}"
fi

# Summary
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ SETUP COMPLETE!${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${WHITE}📋 Next Steps for Jury Demonstration:${NC}"
echo ""
echo -e "${YELLOW}1. Run complete demo (recommended):${NC}"
echo -e "${CYAN}   npm run demo:jury${NC}"
echo ""
echo -e "${YELLOW}2. View HTML report:${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${CYAN}   open audit/security-audit.html${NC}"
else
    echo -e "${CYAN}   xdg-open audit/security-audit.html${NC}"
fi
echo ""
echo -e "${YELLOW}3. Run security tests:${NC}"
echo -e "${CYAN}   npm run test:security${NC}"
echo ""
echo -e "${YELLOW}4. For more options, see:${NC}"
echo -e "${CYAN}   docs/SECURITY-DEMO-README.md${NC}"
echo ""

echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""

# Ask if user wants to open the report
read -p "Would you like to open the HTML report now? (Y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "audit/security-audit.html" ]; then
        echo ""
        echo -e "${YELLOW}🌐 Opening HTML report in browser...${NC}"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open "audit/security-audit.html"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open "audit/security-audit.html"
        else
            echo -e "${YELLOW}   ℹ️  Please open audit/security-audit.html manually${NC}"
        fi
    else
        echo ""
        echo -e "${YELLOW}   ⚠️  HTML report not found. Please run the audit first.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✨ Ready for demonstration! Good luck!${NC}"
echo ""
