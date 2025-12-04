/**
 * Live Attack Demonstration Script
 * 
 * Este script ejecuta ataques simulados en vivo y muestra los resultados
 * de forma visual para demostración al jurado.
 */

import request from 'supertest';
import app from '../src/app';
import chalk from 'chalk';

interface AttackResult {
  category: string;
  payload: any;
  endpoint: string;
  method: string;
  status: number;
  blocked: boolean;
  responseTime: number;
}

class LiveAttackDemo {
  private results: AttackResult[] = [];
  private totalAttacks = 0;
  private blockedAttacks = 0;

  async runDemo() {
    console.clear();
    this.printHeader();

    await this.demoNoSQLInjection();
    await this.demoXSS();
    await this.demoSQLInjection();
    await this.demoCommandInjection();
    await this.demoPathTraversal();
    await this.demoPrototypePollution();
    await this.demoBufferOverflow();
    await this.demoInvalidTypes();

    this.printSummary();
  }

  private printHeader() {
    console.log(chalk.bold.cyan('═════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('   🛡️  LIVE SECURITY ATTACK DEMONSTRATION'));
    console.log(chalk.bold.cyan('   Scenario 2: Prevention Against Common Attacks'));
    console.log(chalk.bold.cyan('═════════════════════════════════════════════════════════════'));
    console.log();
    console.log(chalk.yellow('⚠️  Simulating real attacks to demonstrate security measures...'));
    console.log();
  }

  private async demoNoSQLInjection() {
    console.log(chalk.bold.yellow('━━━ 1. NoSQL INJECTION ATTACKS ━━━'));
    
    const attacks = [
      {
        name: '$gt operator injection',
        payload: { username: { $gt: '' }, password: { $gt: '' } }
      },
      {
        name: '$ne operator injection',
        payload: { username: { $ne: null }, password: { $ne: null } }
      },
      {
        name: '$regex wildcard injection',
        payload: { username: { $regex: '.*' }, password: { $regex: '.*' } }
      },
      {
        name: '$where code injection',
        payload: { username: { $where: '1==1' }, password: 'test' }
      }
    ];

    for (const attack of attacks) {
      await this.executeAttack(
        'NoSQL Injection',
        attack.name,
        attack.payload,
        '/api/auth/login',
        'POST'
      );
    }
    console.log();
  }

  private async demoXSS() {
    console.log(chalk.bold.yellow('━━━ 2. CROSS-SITE SCRIPTING (XSS) ATTACKS ━━━'));
    
    const attacks = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg/onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')">'
    ];

    for (const payload of attacks) {
      await this.executeAttack(
        'XSS',
        payload.substring(0, 30) + '...',
        { username: payload, email: 'test@test.com', password: 'ValidPass123!' },
        '/api/auth/register',
        'POST'
      );
    }
    console.log();
  }

  private async demoSQLInjection() {
    console.log(chalk.bold.yellow('━━━ 3. SQL INJECTION PATTERNS ━━━'));
    
    const attacks = [
      "' OR '1'='1",
      "'; DROP TABLE users--",
      "' OR 1=1--",
      "admin'--",
      "' UNION SELECT NULL--"
    ];

    for (const payload of attacks) {
      await this.executeAttack(
        'SQL Injection',
        payload,
        { username: payload, password: 'test' },
        '/api/auth/login',
        'POST'
      );
    }
    console.log();
  }

  private async demoCommandInjection() {
    console.log(chalk.bold.yellow('━━━ 4. COMMAND INJECTION ATTACKS ━━━'));
    
    const attacks = [
      '; ls -la',
      '| cat /etc/passwd',
      '& whoami',
      '`id`',
      '$(whoami)'
    ];

    for (const payload of attacks) {
      await this.executeAttack(
        'Command Injection',
        payload,
        { username: `user${payload}`, email: 'test@test.com', password: 'ValidPass123!' },
        '/api/auth/register',
        'POST'
      );
    }
    console.log();
  }

  private async demoPathTraversal() {
    console.log(chalk.bold.yellow('━━━ 5. PATH TRAVERSAL ATTACKS ━━━'));
    
    const attacks = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd',
      '/etc/passwd',
      'C:\\Windows\\System32\\config\\SAM'
    ];

    for (const payload of attacks) {
      await this.executeAttack(
        'Path Traversal',
        payload,
        { username: payload, email: 'test@test.com', password: 'ValidPass123!' },
        '/api/auth/register',
        'POST'
      );
    }
    console.log();
  }

  private async demoPrototypePollution() {
    console.log(chalk.bold.yellow('━━━ 6. PROTOTYPE POLLUTION ATTACKS ━━━'));
    
    const attacks: Array<{ name: string; payload: any }> = [
      {
        name: '__proto__ injection',
        payload: { username: 'test', email: 'test@test.com', password: 'ValidPass123!', __proto__: { isAdmin: true } } as any
      },
      {
        name: 'constructor.prototype injection',
        payload: { username: 'test', email: 'test@test.com', password: 'ValidPass123!', constructor: { prototype: { isAdmin: true } } } as any
      }
    ];

    for (const attack of attacks) {
      await this.executeAttack(
        'Prototype Pollution',
        attack.name,
        attack.payload,
        '/api/auth/register',
        'POST'
      );
    }
    console.log();
  }

  private async demoBufferOverflow() {
    console.log(chalk.bold.yellow('━━━ 7. BUFFER OVERFLOW ATTEMPTS ━━━'));
    
    const attacks = [
      {
        name: 'Extremely long username (10000 chars)',
        field: 'username',
        value: 'A'.repeat(10000)
      },
      {
        name: 'Extremely long email (10000 chars)',
        field: 'email',
        value: 'A'.repeat(9990) + '@test.com'
      },
      {
        name: 'Extremely long password (10000 chars)',
        field: 'password',
        value: 'A'.repeat(10000)
      }
    ];

    for (const attack of attacks) {
      const payload: any = {
        username: 'validuser',
        email: 'valid@test.com',
        password: 'ValidPass123!'
      };
      payload[attack.field] = attack.value;

      await this.executeAttack(
        'Buffer Overflow',
        attack.name,
        payload,
        '/api/auth/register',
        'POST'
      );
    }
    console.log();
  }

  private async demoInvalidTypes() {
    console.log(chalk.bold.yellow('━━━ 8. INVALID DATA TYPE ATTACKS ━━━'));
    
    const attacks = [
      {
        name: 'Number as username',
        payload: { username: 12345, email: 'test@test.com', password: 'ValidPass123!' }
      },
      {
        name: 'Boolean as email',
        payload: { username: 'test', email: true, password: 'ValidPass123!' }
      },
      {
        name: 'Object as password',
        payload: { username: 'test', email: 'test@test.com', password: { nested: 'object' } }
      },
      {
        name: 'Array as username',
        payload: { username: ['array', 'value'], email: 'test@test.com', password: 'ValidPass123!' }
      }
    ];

    for (const attack of attacks) {
      await this.executeAttack(
        'Invalid Type',
        attack.name,
        attack.payload,
        '/api/auth/register',
        'POST'
      );
    }
    console.log();
  }

  private async executeAttack(
    category: string,
    description: string,
    payload: any,
    endpoint: string,
    method: string
  ): Promise<void> {
    const startTime = Date.now();
    this.totalAttacks++;

    try {
      const response = await request(app)
        [method.toLowerCase() as 'get' | 'post'](endpoint)
        .send(payload);

      const responseTime = Date.now() - startTime;
      const blocked = response.status === 400;

      if (blocked) {
        this.blockedAttacks++;
      }

      this.results.push({
        category,
        payload,
        endpoint,
        method,
        status: response.status,
        blocked,
        responseTime
      });

      // Visual feedback
      const icon = blocked ? chalk.green('✅') : chalk.red('❌');
      const statusColor = blocked ? chalk.green : chalk.red;
      const time = chalk.gray(`(${responseTime}ms)`);

      console.log(
        `${icon} ${statusColor(category.padEnd(20))} | ${description.substring(0, 50).padEnd(50)} | ${statusColor(response.status.toString())} ${time}`
      );
    } catch (error) {
      console.log(chalk.red(`❌ Error executing attack: ${error}`));
    }

    // Small delay for visual effect
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private printSummary() {
    console.log();
    console.log(chalk.bold.cyan('═════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('   📊 ATTACK DEMONSTRATION SUMMARY'));
    console.log(chalk.bold.cyan('═════════════════════════════════════════════════════════════'));
    console.log();

    const blockRate = (this.blockedAttacks / this.totalAttacks * 100).toFixed(2);
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / this.results.length;

    console.log(chalk.white('Total Attacks Simulated:   ') + chalk.bold.yellow(this.totalAttacks.toString()));
    console.log(chalk.white('Attacks Blocked:           ') + chalk.bold.green(this.blockedAttacks.toString()));
    console.log(chalk.white('Attacks Not Blocked:       ') + chalk.bold.red((this.totalAttacks - this.blockedAttacks).toString()));
    console.log(chalk.white('Block Rate:                ') + chalk.bold.cyan(`${blockRate}%`));
    console.log(chalk.white('Average Response Time:     ') + chalk.gray(`${avgResponseTime.toFixed(2)}ms`));
    console.log();

    // Category breakdown
    console.log(chalk.bold.white('━━━ Attacks by Category ━━━'));
    const categoryStats = this.getCategoryStats();
    
    Object.entries(categoryStats).forEach(([category, stats]) => {
      const rate = ((stats.blocked / stats.total) * 100).toFixed(0);
      const bar = this.generateBar(stats.blocked, stats.total);
      console.log(`${category.padEnd(25)} ${bar} ${chalk.cyan(rate + '%')} (${stats.blocked}/${stats.total})`);
    });

    console.log();

    // Final verdict
    if (this.blockedAttacks === this.totalAttacks) {
      console.log(chalk.bold.green('✅✅✅ ALL ATTACKS SUCCESSFULLY BLOCKED! ✅✅✅'));
      console.log(chalk.green('The system demonstrates 100% protection against common attacks.'));
      console.log(chalk.green('Scenario 2 requirements: FULLY COMPLIANT'));
    } else {
      console.log(chalk.bold.red('❌ WARNING: Some attacks were not blocked!'));
      console.log(chalk.red(`${this.totalAttacks - this.blockedAttacks} vulnerabilities detected.`));
    }

    console.log();
    console.log(chalk.bold.cyan('═════════════════════════════════════════════════════════════'));
    console.log();
  }

  private getCategoryStats(): Record<string, { total: number; blocked: number }> {
    const stats: Record<string, { total: number; blocked: number }> = {};

    this.results.forEach(result => {
      if (!stats[result.category]) {
        stats[result.category] = { total: 0, blocked: 0 };
      }
      stats[result.category].total++;
      if (result.blocked) {
        stats[result.category].blocked++;
      }
    });

    return stats;
  }

  private generateBar(blocked: number, total: number): string {
    const barLength = 20;
    const filled = Math.round((blocked / total) * barLength);
    const empty = barLength - filled;
    
    const filledBar = chalk.green('█'.repeat(filled));
    const emptyBar = chalk.gray('░'.repeat(empty));
    
    return `[${filledBar}${emptyBar}]`;
  }
}

// Run demo
console.log(chalk.yellow('Initializing attack demonstration...'));
console.log(chalk.yellow('Please wait while the system starts...\n'));

// Check if chalk is available, if not, provide fallback
const chalkAvailable = (() => {
  try {
    require.resolve('chalk');
    return true;
  } catch {
    return false;
  }
})();

if (!chalkAvailable) {
  console.warn('⚠️  Chalk not installed. Installing for better visualization...');
  console.warn('Run: npm install --save-dev chalk@4.1.2');
  console.warn('Continuing without colors...\n');
}

const demo = new LiveAttackDemo();
demo.runDemo()
  .then(() => {
    console.log('Demo completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
