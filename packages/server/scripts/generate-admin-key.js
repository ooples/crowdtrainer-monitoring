#!/usr/bin/env node

const { randomBytes } = require('crypto');
const path = require('path');
const fs = require('fs');

// Generate a secure admin API key
const generateAdminKey = () => {
  const prefix = 'msk_admin_'; // monitoring service key
  const randomPart = randomBytes(32).toString('hex');
  return `${prefix}${randomPart}`;
};

const adminKey = generateAdminKey();

console.log('=================================');
console.log('Generated Admin API Key:');
console.log(adminKey);
console.log('=================================');
console.log('');
console.log('Add this to your dashboard environment:');
console.log(`NEXT_PUBLIC_MONITORING_API_KEY=${adminKey}`);
console.log('');
console.log('Or update monitoring-service/packages/dashboard/.env.local');

// Also save to a secure location
const envPath = path.join(__dirname, '../../dashboard/.env.local');
const envContent = `# Monitoring Dashboard Configuration
NEXT_PUBLIC_MONITORING_API_URL=http://localhost:4001
NEXT_PUBLIC_MONITORING_API_KEY=${adminKey}
`;

try {
  fs.writeFileSync(envPath, envContent);
  console.log(`✓ Saved to ${envPath}`);
} catch (error) {
  console.log('Could not auto-save to .env.local:', error.message);
}

// Also update the server's .env to recognize this key
const serverEnvPath = path.join(__dirname, '../.env');
if (fs.existsSync(serverEnvPath)) {
  let serverEnv = fs.readFileSync(serverEnvPath, 'utf8');
  if (!serverEnv.includes('ADMIN_API_KEY')) {
    serverEnv += `\n# Admin API Key\nADMIN_API_KEY=${adminKey}\n`;
    fs.writeFileSync(serverEnvPath, serverEnv);
    console.log('✓ Added admin key to server .env');
  }
}