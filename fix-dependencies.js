#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Define the correct package names in the monorepo
const correctPackageNames = {
  '@crowdtrainer/core': '@monitoring-service/core',
  '@crowdtrainer/alerts': '@monitoring-service/alerts',
  '@crowdtrainer/incident-management': '@monitoring-service/incident-management',
  '@crowdtrainer/intelligence': '@monitoring-service/intelligence',
  '@crowdtrainer/debugging': '@monitoring-service/debugging',
  '@crowdtrainer/notifications': '@monitoring-service/notifications',
  '@crowdtrainer/predictive-analytics': '@monitoring-service/predictive-analytics',
  '@crowdtrainer/security': '@monitoring-service/security',
  '@crowdtrainer/business-intelligence': '@monitoring-service/business-intelligence',
  '@monitoring/core': '@monitoring-service/core',
  '@monitoring/sdk-js': '@monitoring-service/sdk-js',
  '@monitoring/sdk-react': '@monitoring-service/sdk-react',
};

// Function to fix package.json
function fixPackageJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const pkg = JSON.parse(content);
    let modified = false;

    // Fix dependencies
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
      if (pkg[depType]) {
        Object.keys(pkg[depType]).forEach(dep => {
          if (correctPackageNames[dep]) {
            console.log(`  Fixing ${dep} -> ${correctPackageNames[dep]} in ${depType}`);
            pkg[depType][correctPackageNames[dep]] = 'workspace:*';
            delete pkg[depType][dep];
            modified = true;
          }
        });
      }
    });

    // Fix package name if needed
    if (pkg.name && pkg.name.startsWith('@crowdtrainer/')) {
      const newName = pkg.name.replace('@crowdtrainer/', '@monitoring-service/');
      console.log(`  Fixing package name: ${pkg.name} -> ${newName}`);
      pkg.name = newName;
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  ✅ Fixed ${filePath}`);
    }
  } catch (error) {
    console.error(`  ❌ Error fixing ${filePath}:`, error.message);
  }
}

// Function to recursively find and fix all package.json files
function fixAllPackages(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && item !== 'node_modules' && item !== '.git' && item !== 'dist') {
      // Check for package.json in this directory
      const pkgPath = path.join(fullPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        console.log(`\nProcessing ${pkgPath}...`);
        fixPackageJson(pkgPath);
      }
      
      // Recurse into subdirectories for packages folder
      if (item === 'packages' || item === 'examples') {
        fixAllPackages(fullPath);
      }
    }
  });
}

// Main execution
console.log('🔧 Fixing dependency references in all package.json files...\n');

// Fix root package.json
const rootPkg = path.join(__dirname, 'package.json');
if (fs.existsSync(rootPkg)) {
  console.log('Processing root package.json...');
  fixPackageJson(rootPkg);
}

// Fix all packages
fixAllPackages(__dirname);

console.log('\n✅ Dependency fixing complete!');
console.log('\nNow run: pnpm install');