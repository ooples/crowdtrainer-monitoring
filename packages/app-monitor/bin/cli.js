#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const chalk = require('chalk');

const program = new Command();

// Monitoring service paths
const MONITORING_DIR = path.join(__dirname, '..');
const PRODUCTION_SERVER_DIR = path.join(MONITORING_DIR, '..', 'server');
const PRODUCTION_DASHBOARD_DIR = path.join(MONITORING_DIR, '..', 'dashboard');
const DATA_DIR = path.join(process.cwd(), '.monitoring');

program
  .name('app-monitor')
  .description('Application Monitoring Service Manager')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize monitoring service in your project')
  .action(async () => {
    console.log(chalk.blue('🚀 Initializing App Monitor...'));
    
    // Create data directory
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(chalk.green('✓ Created monitoring data directory'));
    }

    // Create config file
    const configPath = path.join(process.cwd(), 'monitoring.config.js');
    if (!fs.existsSync(configPath)) {
      const configTemplate = `module.exports = {
  // API Configuration (standalone monitoring service)
  apiKey: '${generateApiKey()}',
  apiUrl: 'http://localhost:4000/api/v1',
  
  // Dashboard Configuration  
  dashboardPort: 3001,
  dashboardUrl: 'http://localhost:3001',
  
  // Database Configuration (uses embedded SQLite by default)
  database: {
    type: 'sqlite',
    path: '.monitoring/data.db'
  },
  
  // Features
  features: {
    errorTracking: true,
    performanceMonitoring: true,
    userAnalytics: true,
    customEvents: true,
    realtimeAlerts: true
  }
};`;
      
      fs.writeFileSync(configPath, configTemplate);
      console.log(chalk.green('✓ Created monitoring.config.js'));
    }

    // Install SDK in project
    console.log(chalk.blue('📦 Installing monitoring SDK...'));
    
    // Create local SDK file
    const sdkPath = path.join(process.cwd(), 'lib', 'monitoring.js');
    if (!fs.existsSync(path.dirname(sdkPath))) {
      fs.mkdirSync(path.dirname(sdkPath), { recursive: true });
    }
    
    const sdkCode = `// App Monitor SDK
const config = require('../monitoring.config.js');

class MonitoringSDK {
  constructor() {
    this.config = config;
    this.queue = [];
    this.initialized = false;
    this.init();
  }

  init() {
    if (typeof window !== 'undefined') {
      // Browser environment
      window.addEventListener('error', (e) => this.captureError(e.error));
      window.addEventListener('unhandledrejection', (e) => this.captureError(e.reason));
    } else if (typeof process !== 'undefined') {
      // Node.js environment
      process.on('uncaughtException', (error) => this.captureError(error));
      process.on('unhandledRejection', (error) => this.captureError(error));
    }
    
    this.initialized = true;
    this.startBatchSending();
  }

  startBatchSending() {
    setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, 5000);
  }

  async flush() {
    const events = [...this.queue];
    this.queue = [];
    
    try {
      await fetch(\`\${this.config.apiUrl}/api/events/batch\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({ events })
      });
    } catch (error) {
      console.error('Failed to send monitoring events:', error);
      this.queue.unshift(...events);
    }
  }

  trackEvent(name, properties = {}) {
    this.queue.push({
      type: 'event',
      name,
      properties,
      timestamp: Date.now()
    });
  }

  captureError(error, context = {}) {
    this.queue.push({
      type: 'error',
      message: error?.message || String(error),
      stack: error?.stack,
      context,
      timestamp: Date.now()
    });
    this.flush(); // Send errors immediately
  }

  trackPageView(path, properties = {}) {
    this.trackEvent('page_view', { path, ...properties });
  }

  setUser(user) {
    this.user = user;
    this.trackEvent('identify', { user });
  }
}

module.exports = new MonitoringSDK();
`;
    
    fs.writeFileSync(sdkPath, sdkCode);
    console.log(chalk.green('✓ Installed monitoring SDK'));

    console.log(chalk.green('\n✅ Monitoring initialized successfully!'));
    console.log(chalk.cyan('\nNext steps:'));
    console.log('1. Start the monitoring service: ' + chalk.yellow('npx app-monitor start'));
    console.log('2. Import the SDK in your app: ' + chalk.yellow("const monitoring = require('./lib/monitoring')"));
    console.log('3. View the dashboard at: ' + chalk.yellow('http://localhost:3001'));
  });

program
  .command('start')
  .description('Start standalone monitoring service')
  .option('-d, --daemon', 'Run in background')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Starting App Monitor Service...'));
    
    // Start production API server
    console.log(chalk.blue('🔧 Starting production API server on port 4000...'));
    const serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: PRODUCTION_SERVER_DIR,
      detached: options.daemon,
      stdio: options.daemon ? 'ignore' : 'inherit',
      windowsHide: true,
      shell: true,
      env: {
        ...process.env,
        PORT: '4000',
        NODE_ENV: 'development'
      }
    });
    
    if (options.daemon) {
      serverProcess.unref();
    }

    // Wait for server to start
    setTimeout(() => {
      // Start production React dashboard
      console.log(chalk.blue('📈 Starting production dashboard on port 3001...'));
      const dashboardProcess = spawn('npm', ['run', 'dev'], {
        cwd: PRODUCTION_DASHBOARD_DIR,
        detached: options.daemon,
        stdio: options.daemon ? 'ignore' : 'inherit',
        windowsHide: true,
        shell: true
      });
      
      if (options.daemon) {
        dashboardProcess.unref();
      }
    }, 3000);

    setTimeout(() => {
      console.log(chalk.green('\n✅ Monitoring Service started!'));
      console.log('\n' + chalk.cyan('Access points:'));
      console.log('  API Server:  ' + chalk.yellow('http://localhost:4000'));
      console.log('  API Docs:    ' + chalk.yellow('http://localhost:4000/docs'));
      console.log('  Dashboard:   ' + chalk.yellow('http://localhost:5001'));
      console.log('\n' + chalk.gray('Run "npx app-monitor stop" to stop services'));
      
      if (!options.daemon) {
        console.log(chalk.gray('Press Ctrl+C to stop...'));
      }
    }, 5000);
  });

program
  .command('stop')
  .description('Stop all monitoring services')
  .action(() => {
    console.log(chalk.blue('🛑 Stopping monitoring services...'));
    
    // Windows specific stop
    exec('taskkill /F /FI "WINDOWTITLE eq Monitoring*" 2>nul', (error) => {
      if (!error) {
        console.log(chalk.green('✓ Services stopped'));
      } else {
        // Stop both server and dashboard
        exec('netstat -ano | findstr :4000', (err, stdout) => {
          if (stdout) {
            const pid = stdout.split(/\s+/)[5];
            exec(`taskkill /F /PID ${pid} 2>nul`);
          }
        });
        
        exec('netstat -ano | findstr :3001', (err, stdout) => {
          if (stdout) {
            const pid = stdout.split(/\s+/)[5];
            exec(`taskkill /F /PID ${pid} 2>nul`);
          }
        });
        
        console.log(chalk.green('✓ Services stopped'));
      }
    });
  });

program
  .command('status')
  .description('Check monitoring services status')
  .action(async () => {
    console.log(chalk.blue('📊 Checking monitoring services status...\n'));
    
    // Check API server
    exec('netstat -an | findstr :4000', (error, stdout) => {
      if (stdout.includes('LISTENING')) {
        console.log(chalk.green('✓ API Server: Running on port 4000'));
      } else {
        console.log(chalk.red('✗ API Server: Not running'));
      }
    });
    
    // Check dashboard
    exec('netstat -an | findstr :3001', (error, stdout) => {
      if (stdout.includes('LISTENING')) {
        console.log(chalk.green('✓ Dashboard:   Running on port 3001'));
      } else {
        console.log(chalk.red('✗ Dashboard:   Not running'));
      }
    });
  });

function generateApiKey() {
  return 'ctm_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

program.parse();