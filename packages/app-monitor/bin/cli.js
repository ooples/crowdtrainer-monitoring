#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const chalk = require('chalk');
const net = require('net');

const program = new Command();

// Monitoring service paths
const MONITORING_DIR = path.join(__dirname, '..');
const PRODUCTION_SERVER_DIR = path.join(MONITORING_DIR, '..', 'server');
const PRODUCTION_DASHBOARD_DIR = path.join(MONITORING_DIR, '..', 'dashboard');
const DATA_DIR = path.join(process.cwd(), '.monitoring');
const CONFIG_PATH = path.join(process.cwd(), 'monitoring.config.js');

// Port detection utility
async function findAvailablePort(startPort, excludePorts = []) {
  let port = startPort;
  const maxAttempts = 100;
  
  for (let i = 0; i < maxAttempts; i++) {
    if (!excludePorts.includes(port) && await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  
  throw new Error(`Could not find an available port starting from ${startPort}`);
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, '127.0.0.1');
  });
}

// Integrate monitoring service with target application's startup
function integrateWithAppStartup(apiPort, dashboardPort, dbPort, redisPort) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(chalk.yellow('⚠️  No package.json found - skipping startup integration'));
    return;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Backup original package.json
    fs.writeFileSync(`${packageJsonPath}.backup`, JSON.stringify(packageJson, null, 2));
    
    // Check what kind of application this is
    const isNextJs = packageJson.dependencies?.next || packageJson.devDependencies?.next;
    const isReact = packageJson.dependencies?.react || packageJson.devDependencies?.react;
    const isNode = packageJson.scripts?.start;
    
    // Store original scripts
    if (packageJson.scripts) {
      // Rename original dev script if it exists
      if (packageJson.scripts.dev && !packageJson.scripts['dev:original']) {
        packageJson.scripts['dev:original'] = packageJson.scripts.dev;
      }
      
      // Create monitoring startup script
      const monitoringStartScript = `
const { spawn } = require('child_process');
const path = require('path');

// Start monitoring services
console.log('Starting monitoring services...');

// Start monitoring databases
const startMonitoringDb = spawn('docker', ['start', 'monitoring-timescaledb', 'monitoring-redis'], {
  shell: true,
  stdio: 'inherit'
});

// Start monitoring API
const startMonitoringApi = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'monitoring-service/packages/server'),
  shell: true,
  env: { ...process.env, PORT: ${apiPort} }
});

// Start monitoring dashboard  
const startMonitoringDashboard = spawn('npm', ['run', 'dev', '--', '-p', '${dashboardPort}'], {
  cwd: path.join(__dirname, 'monitoring-service/packages/dashboard'),
  shell: true
});

// Start original application
setTimeout(() => {
  console.log('Starting main application...');
  const startApp = spawn('npm', ['run', 'dev:original'], {
    shell: true,
    stdio: 'inherit'
  });
  
  // Handle shutdown
  process.on('SIGINT', () => {
    startApp.kill();
    startMonitoringApi.kill();
    startMonitoringDashboard.kill();
    process.exit(0);
  });
}, 3000);
`;
      
      // Write the startup script
      const startupScriptPath = path.join(process.cwd(), '.monitoring', 'start-with-monitoring.js');
      fs.writeFileSync(startupScriptPath, monitoringStartScript);
      
      // Update package.json scripts
      packageJson.scripts['dev'] = `node .monitoring/start-with-monitoring.js`;
      packageJson.scripts['dev:no-monitoring'] = packageJson.scripts['dev:original'] || 'echo "No original dev script found"';
      packageJson.scripts['monitoring:status'] = `cd monitoring-service/packages/app-monitor && node bin/cli.js status`;
      packageJson.scripts['monitoring:stop'] = `docker stop monitoring-timescaledb monitoring-redis 2>/dev/null || true`;
      
      // For production
      if (packageJson.scripts.start && !packageJson.scripts['start:original']) {
        packageJson.scripts['start:original'] = packageJson.scripts.start;
        packageJson.scripts['start'] = `NODE_ENV=production node .monitoring/start-with-monitoring.js`;
        packageJson.scripts['start:no-monitoring'] = packageJson.scripts['start:original'];
      }
    }
    
    // Save updated package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green('✓ Integrated monitoring with application startup scripts'));
    console.log(chalk.cyan('  • Use "npm run dev" to start with monitoring'));
    console.log(chalk.cyan('  • Use "npm run dev:no-monitoring" to start without monitoring'));
    
    // Add monitoring config to .env if exists
    const envPath = path.join(process.cwd(), '.env');
    const envLocalPath = path.join(process.cwd(), '.env.local');
    const envConfig = `
# Monitoring Service Configuration
MONITORING_ENABLED=true
MONITORING_API_URL=http://localhost:${apiPort}
MONITORING_DASHBOARD_URL=http://localhost:${dashboardPort}
`;
    
    if (fs.existsSync(envLocalPath)) {
      let envContent = fs.readFileSync(envLocalPath, 'utf8');
      if (!envContent.includes('MONITORING_ENABLED')) {
        envContent += envConfig;
        fs.writeFileSync(envLocalPath, envContent);
        console.log(chalk.green('✓ Added monitoring config to .env.local'));
      }
    } else if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (!envContent.includes('MONITORING_ENABLED')) {
        envContent += envConfig;
        fs.writeFileSync(envPath, envContent);
        console.log(chalk.green('✓ Added monitoring config to .env'));
      }
    }
    
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not integrate with startup scripts:', error.message));
  }
}

// Scan for commonly used ports by web applications
async function detectUsedPorts() {
  const commonPorts = [
    3000, 3001, 3002, 3003, // React/Next.js apps
    4000, 4001, 4200,       // API servers, Angular
    5000, 5001, 5002, 5173, // Flask, Vite, monitoring dashboards
    5432, 5433,             // PostgreSQL
    6379, 6380,             // Redis
    8000, 8080, 8081,       // Various servers
    9000, 9090,             // Prometheus, various
    27017,                  // MongoDB
  ];
  
  const usedPorts = [];
  
  console.log(chalk.blue('🔍 Scanning for used ports...'));
  
  for (const port of commonPorts) {
    if (!(await isPortAvailable(port))) {
      usedPorts.push(port);
    }
  }
  
  return usedPorts;
}

program
  .name('app-monitor')
  .description('Application Monitoring Service Manager')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize monitoring service in your project')
  .option('--api-port <port>', 'Specify API server port')
  .option('--dashboard-port <port>', 'Specify dashboard port')
  .option('--db-port <port>', 'Specify database port')
  .option('--redis-port <port>', 'Specify Redis port')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Initializing App Monitor...'));
    
    // Detect used ports
    const usedPorts = await detectUsedPorts();
    
    if (usedPorts.length > 0) {
      console.log(chalk.yellow(`⚠️  Detected ${usedPorts.length} ports in use: ${usedPorts.join(', ')}`));
    }
    
    // Find available ports for monitoring services
    const apiPort = options.apiPort ? parseInt(options.apiPort) : await findAvailablePort(4000, usedPorts);
    const dashboardPort = options.dashboardPort ? parseInt(options.dashboardPort) : await findAvailablePort(5002, [...usedPorts, apiPort]);
    const dbPort = options.dbPort ? parseInt(options.dbPort) : await findAvailablePort(5433, [...usedPorts, apiPort, dashboardPort]);
    const redisPort = options.redisPort ? parseInt(options.redisPort) : await findAvailablePort(6380, [...usedPorts, apiPort, dashboardPort, dbPort]);
    
    console.log(chalk.green('✓ Found available ports:'));
    console.log(chalk.cyan(`  API Server:  ${apiPort}`));
    console.log(chalk.cyan(`  Dashboard:   ${dashboardPort}`));
    console.log(chalk.cyan(`  Database:    ${dbPort}`));
    console.log(chalk.cyan(`  Redis:       ${redisPort}`));
    
    // Create data directory
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(chalk.green('✓ Created monitoring data directory'));
    }

    // Create config file with detected ports
    if (!fs.existsSync(CONFIG_PATH)) {
      const configTemplate = `module.exports = {
  // API Configuration (standalone monitoring service)
  apiKey: '${generateApiKey()}',
  apiUrl: 'http://localhost:${apiPort}/api/v1',
  apiPort: ${apiPort},
  
  // Dashboard Configuration  
  dashboardPort: ${dashboardPort},
  dashboardUrl: 'http://localhost:${dashboardPort}',
  
  // Database Configuration
  database: {
    type: 'postgresql',
    host: 'localhost',
    port: ${dbPort},
    name: 'monitoring_db',
    user: 'monitoring_user',
    password: 'dev_password'
  },
  
  // Redis Configuration
  redis: {
    host: 'localhost',
    port: ${redisPort},
    password: 'dev_redis'
  },
  
  // Docker Configuration
  docker: {
    dbPort: ${dbPort},
    redisPort: ${redisPort},
    apiPort: ${apiPort},
    dashboardPort: ${dashboardPort}
  },
  
  // Features
  features: {
    errorTracking: true,
    performanceMonitoring: true,
    userAnalytics: true,
    customEvents: true,
    realtimeAlerts: true
  },
  
  // Target Application Detection
  targetApp: {
    detectedPorts: [${usedPorts.join(', ')}],
    scanTimestamp: '${new Date().toISOString()}'
  }
};`;
      
      fs.writeFileSync(CONFIG_PATH, configTemplate);
      console.log(chalk.green('✓ Created monitoring.config.js with conflict-free ports'));
    } else {
      console.log(chalk.yellow('⚠️  monitoring.config.js already exists'));
      
      // Update existing config with new port information
      const existingConfig = require(CONFIG_PATH);
      if (!existingConfig.docker || !existingConfig.targetApp) {
        console.log(chalk.blue('📝 Updating existing config with port information...'));
        
        const updatedConfig = `// Updated by App Monitor CLI on ${new Date().toISOString()}
const config = ${JSON.stringify({
          ...existingConfig,
          apiPort: apiPort,
          dashboardPort: dashboardPort,
          docker: {
            dbPort: dbPort,
            redisPort: redisPort,
            apiPort: apiPort,
            dashboardPort: dashboardPort
          },
          targetApp: {
            detectedPorts: usedPorts,
            scanTimestamp: new Date().toISOString()
          }
        }, null, 2)};

module.exports = config;`;
        
        fs.writeFileSync(CONFIG_PATH, updatedConfig);
        console.log(chalk.green('✓ Updated configuration with port mappings'));
      }
    }
    
    // Create docker-compose override file with custom ports
    const dockerOverridePath = path.join(process.cwd(), '.monitoring', 'docker-compose.override.yml');
    const dockerOverrideContent = `# Auto-generated by App Monitor to avoid port conflicts
version: '3.8'

services:
  postgres:
    ports:
      - "${dbPort}:5432"
  
  redis:
    ports:
      - "${redisPort}:6379"
  
  server:
    ports:
      - "${apiPort}:4000"
    environment:
      DATABASE_PORT: ${dbPort}
      REDIS_PORT: ${redisPort}
  
  dashboard:
    ports:
      - "${dashboardPort}:5001"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:${apiPort}
`;
    
    fs.writeFileSync(dockerOverridePath, dockerOverrideContent);
    console.log(chalk.green('✓ Created Docker Compose override with custom ports'));

    // Install SDK in project
    console.log(chalk.blue('📦 Installing monitoring SDK...'));
    
    // Create local SDK file
    const sdkPath = path.join(process.cwd(), 'lib', 'monitoring.js');
    if (!fs.existsSync(path.dirname(sdkPath))) {
      fs.mkdirSync(path.dirname(sdkPath), { recursive: true });
    }
    
    // Integrate with target application's startup
    console.log(chalk.blue('🔧 Integrating with application startup...'));
    integrateWithAppStartup(apiPort, dashboardPort, dbPort, redisPort);
    
    const sdkCode = `// App Monitor SDK - Auto-configured
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
      await fetch(\`\${this.config.apiUrl}/events\`, {
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
    console.log(chalk.cyan('\nYour monitoring service will use these ports:'));
    console.log('  API Server:  ' + chalk.yellow(`http://localhost:${apiPort}`));
    console.log('  Dashboard:   ' + chalk.yellow(`http://localhost:${dashboardPort}`));
    console.log('  Database:    ' + chalk.yellow(`localhost:${dbPort}`));
    console.log('  Redis:       ' + chalk.yellow(`localhost:${redisPort}`));
    console.log(chalk.cyan('\nNext steps:'));
    console.log('1. Start the monitoring service: ' + chalk.yellow('npx app-monitor start'));
    console.log('2. Import the SDK in your app: ' + chalk.yellow("const monitoring = require('./lib/monitoring')"));
    console.log('3. View the dashboard at: ' + chalk.yellow(`http://localhost:${dashboardPort}`));
  });

program
  .command('start')
  .description('Start standalone monitoring service')
  .option('-d, --daemon', 'Run in background')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Starting App Monitor Service...'));
    
    // Load configuration
    let config;
    try {
      config = require(CONFIG_PATH);
    } catch (err) {
      console.log(chalk.red('❌ No monitoring.config.js found. Run "npx app-monitor init" first.'));
      process.exit(1);
    }
    
    const apiPort = config.apiPort || 4000;
    const dashboardPort = config.dashboardPort || 5001;
    const dbPort = config.database?.port || 5433;
    const redisPort = config.redis?.port || 6380;
    
    console.log(chalk.blue('📋 Using configuration:'));
    console.log(chalk.cyan(`  API Port:       ${apiPort}`));
    console.log(chalk.cyan(`  Dashboard Port: ${dashboardPort}`));
    console.log(chalk.cyan(`  Database Port:  ${dbPort}`));
    console.log(chalk.cyan(`  Redis Port:     ${redisPort}`));
    
    // Check for port conflicts before starting
    const portsToCheck = [apiPort, dashboardPort, dbPort, redisPort];
    const conflicts = [];
    
    for (const port of portsToCheck) {
      if (!(await isPortAvailable(port))) {
        conflicts.push(port);
      }
    }
    
    if (conflicts.length > 0) {
      console.log(chalk.red(`\n❌ Port conflict detected! The following ports are already in use: ${conflicts.join(', ')}`));
      console.log(chalk.yellow('Please stop the conflicting services or re-run "npx app-monitor init" to reconfigure.'));
      process.exit(1);
    }
    
    // Start Docker services with custom ports
    console.log(chalk.blue('🐳 Starting Docker services...'));
    const dockerCompose = spawn('docker-compose', [
      '-f', path.join(MONITORING_DIR, '..', 'docker-compose.yml'),
      '-f', path.join(DATA_DIR, 'docker-compose.override.yml'),
      'up', '-d', 'postgres', 'redis'
    ], {
      cwd: MONITORING_DIR,
      stdio: 'inherit',
      shell: true
    });
    
    dockerCompose.on('close', (code) => {
      if (code !== 0) {
        console.log(chalk.yellow('⚠️  Docker services failed to start. Using embedded database instead.'));
      }
    });
    
    // Start production API server
    console.log(chalk.blue(`🔧 Starting production API server on port ${apiPort}...`));
    const serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: PRODUCTION_SERVER_DIR,
      detached: options.daemon,
      stdio: options.daemon ? 'ignore' : 'inherit',
      windowsHide: true,
      shell: true,
      env: {
        ...process.env,
        PORT: String(apiPort),
        DATABASE_PORT: String(dbPort),
        REDIS_PORT: String(redisPort),
        NODE_ENV: 'development'
      }
    });
    
    if (options.daemon) {
      serverProcess.unref();
    }

    // Wait for server to start
    setTimeout(() => {
      // Start production React dashboard
      console.log(chalk.blue(`📈 Starting production dashboard on port ${dashboardPort}...`));
      const dashboardProcess = spawn('npm', ['run', 'dev'], {
        cwd: PRODUCTION_DASHBOARD_DIR,
        detached: options.daemon,
        stdio: options.daemon ? 'ignore' : 'inherit',
        windowsHide: true,
        shell: true,
        env: {
          ...process.env,
          PORT: String(dashboardPort),
          NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}`,
          NODE_ENV: 'development'
        }
      });
      
      if (options.daemon) {
        dashboardProcess.unref();
      }
    }, 3000);

    setTimeout(() => {
      console.log(chalk.green('\n✅ Monitoring Service started!'));
      console.log('\n' + chalk.cyan('Access points:'));
      console.log('  API Server:  ' + chalk.yellow(`http://localhost:${apiPort}`));
      console.log('  API Docs:    ' + chalk.yellow(`http://localhost:${apiPort}/docs`));
      console.log('  Dashboard:   ' + chalk.yellow(`http://localhost:${dashboardPort}`));
      console.log('\n' + chalk.gray('Run "npx app-monitor stop" to stop services'));
      
      if (!options.daemon) {
        console.log(chalk.gray('Press Ctrl+C to stop...'));
      }
    }, 5000);
  });

program
  .command('stop')
  .description('Stop all monitoring services')
  .action(async () => {
    console.log(chalk.blue('🛑 Stopping monitoring services...'));
    
    // Load configuration to get ports
    let config;
    try {
      config = require(CONFIG_PATH);
    } catch (err) {
      config = { apiPort: 4000, dashboardPort: 5001 };
    }
    
    const apiPort = config.apiPort || 4000;
    const dashboardPort = config.dashboardPort || 5001;
    
    // Stop Docker services
    console.log(chalk.blue('🐳 Stopping Docker services...'));
    exec('docker-compose down', { cwd: path.join(MONITORING_DIR, '..') }, (err) => {
      if (!err) {
        console.log(chalk.green('✓ Docker services stopped'));
      }
    });
    
    // Windows specific stop
    exec('taskkill /F /FI "WINDOWTITLE eq Monitoring*" 2>nul', (error) => {
      if (!error) {
        console.log(chalk.green('✓ Services stopped'));
      } else {
        // Stop both server and dashboard by port
        exec(`netstat -ano | findstr :${apiPort}`, (err, stdout) => {
          if (stdout) {
            const pid = stdout.split(/\s+/)[5];
            exec(`taskkill /F /PID ${pid} 2>nul`);
          }
        });
        
        exec(`netstat -ano | findstr :${dashboardPort}`, (err, stdout) => {
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
    
    // Load configuration
    let config;
    try {
      config = require(CONFIG_PATH);
    } catch (err) {
      console.log(chalk.red('❌ No monitoring.config.js found. Run "npx app-monitor init" first.'));
      return;
    }
    
    const apiPort = config.apiPort || 4000;
    const dashboardPort = config.dashboardPort || 5001;
    const dbPort = config.database?.port || 5433;
    const redisPort = config.redis?.port || 6380;
    
    // Check API server
    if (await isPortAvailable(apiPort)) {
      console.log(chalk.red(`✗ API Server: Not running (port ${apiPort})`));
    } else {
      console.log(chalk.green(`✓ API Server: Running on port ${apiPort}`));
    }
    
    // Check dashboard
    if (await isPortAvailable(dashboardPort)) {
      console.log(chalk.red(`✗ Dashboard:   Not running (port ${dashboardPort})`));
    } else {
      console.log(chalk.green(`✓ Dashboard:   Running on port ${dashboardPort}`));
    }
    
    // Check database
    if (await isPortAvailable(dbPort)) {
      console.log(chalk.red(`✗ Database:    Not running (port ${dbPort})`));
    } else {
      console.log(chalk.green(`✓ Database:    Running on port ${dbPort}`));
    }
    
    // Check Redis
    if (await isPortAvailable(redisPort)) {
      console.log(chalk.red(`✗ Redis:       Not running (port ${redisPort})`));
    } else {
      console.log(chalk.green(`✓ Redis:       Running on port ${redisPort}`));
    }
    
    // Show detected target app ports
    if (config.targetApp?.detectedPorts?.length > 0) {
      console.log(chalk.cyan('\nTarget application ports (avoided during init):'));
      console.log(chalk.gray(`  ${config.targetApp.detectedPorts.join(', ')}`));
    }
  });

program
  .command('scan-ports')
  .description('Scan for used ports on the system')
  .action(async () => {
    console.log(chalk.blue('🔍 Scanning system for used ports...\n'));
    
    const usedPorts = await detectUsedPorts();
    
    if (usedPorts.length === 0) {
      console.log(chalk.green('✓ No common ports are in use'));
    } else {
      console.log(chalk.yellow(`Found ${usedPorts.length} ports in use:`));
      usedPorts.forEach(port => {
        console.log(chalk.gray(`  Port ${port}: In use`));
      });
    }
    
    console.log(chalk.cyan('\n💡 App Monitor will automatically avoid these ports during initialization.'));
  });

function generateApiKey() {
  return 'am_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

program.parse();