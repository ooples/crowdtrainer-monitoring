
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
  env: { ...process.env, PORT: 4000 }
});

// Start monitoring dashboard  
const startMonitoringDashboard = spawn('npm', ['run', 'dev', '--', '-p', '5002'], {
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
