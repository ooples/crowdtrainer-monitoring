#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing build issues in all packages...\n');

// Fix 1: Update intelligence package tsconfig
const intelligenceTsConfig = path.join(__dirname, 'packages/intelligence/tsconfig.json');
if (fs.existsSync(intelligenceTsConfig)) {
  console.log('Fixing intelligence tsconfig...');
  const config = {
    "compilerOptions": {
      "target": "ES2020",
      "module": "commonjs",
      "lib": ["ES2020"],
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "types": ["node", "jest"]
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "**/*.test.ts"]
  };
  fs.writeFileSync(intelligenceTsConfig, JSON.stringify(config, null, 2));
  console.log('  ✅ Fixed intelligence tsconfig\n');
}

// Fix 2: Update core package tsconfig to add composite
const coreTsConfig = path.join(__dirname, 'packages/core/tsconfig.json');
if (fs.existsSync(coreTsConfig)) {
  console.log('Fixing core tsconfig...');
  const config = JSON.parse(fs.readFileSync(coreTsConfig, 'utf-8'));
  config.compilerOptions.composite = true;
  fs.writeFileSync(coreTsConfig, JSON.stringify(config, null, 2));
  console.log('  ✅ Added composite to core tsconfig\n');
}

// Fix 3: Add missing dependencies to sdk-js
const sdkJsPkg = path.join(__dirname, 'packages/sdk-js/package.json');
if (fs.existsSync(sdkJsPkg)) {
  console.log('Fixing sdk-js dependencies...');
  const pkg = JSON.parse(fs.readFileSync(sdkJsPkg, 'utf-8'));
  
  // Add missing rollup plugin
  if (!pkg.devDependencies) pkg.devDependencies = {};
  pkg.devDependencies['@rollup/plugin-terser'] = '^0.4.4';
  
  // Remove old plugin reference if exists
  delete pkg.devDependencies['rollup-plugin-terser'];
  
  fs.writeFileSync(sdkJsPkg, JSON.stringify(pkg, null, 2) + '\n');
  console.log('  ✅ Added @rollup/plugin-terser to sdk-js\n');
}

// Fix 4: Update sdk-js rollup config to use new plugin
const sdkJsRollup = path.join(__dirname, 'packages/sdk-js/rollup.config.js');
if (fs.existsSync(sdkJsRollup)) {
  console.log('Fixing sdk-js rollup config...');
  let content = fs.readFileSync(sdkJsRollup, 'utf-8');
  
  // Replace old import with new one
  content = content.replace(
    "import { terser } from 'rollup-plugin-terser';",
    "import terser from '@rollup/plugin-terser';"
  );
  
  fs.writeFileSync(sdkJsRollup, content);
  console.log('  ✅ Updated sdk-js rollup config\n');
}

// Fix 5: Create a base tsconfig for consistency
const baseTsConfig = path.join(__dirname, 'tsconfig.base.json');
console.log('Creating base tsconfig...');
const baseConfig = {
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
};
fs.writeFileSync(baseTsConfig, JSON.stringify(baseConfig, null, 2));
console.log('  ✅ Created base tsconfig\n');

// Fix 6: Update all package tsconfigs to extend base
const packagesDir = path.join(__dirname, 'packages');
const packages = fs.readdirSync(packagesDir);

packages.forEach(pkg => {
  const pkgTsConfig = path.join(packagesDir, pkg, 'tsconfig.json');
  if (fs.existsSync(pkgTsConfig) && pkg !== 'dashboard' && pkg !== 'sdk-react-native') {
    console.log(`Updating ${pkg} tsconfig to extend base...`);
    const config = JSON.parse(fs.readFileSync(pkgTsConfig, 'utf-8'));
    
    // Keep existing config but ensure it extends base
    const newConfig = {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        ...config.compilerOptions,
        "outDir": "./dist",
        "rootDir": "./src",
        "composite": true
      },
      "include": config.include || ["src/**/*"],
      "exclude": config.exclude || ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
    };
    
    // Remove duplicate settings that are in base
    delete newConfig.compilerOptions.target;
    delete newConfig.compilerOptions.module;
    delete newConfig.compilerOptions.lib;
    delete newConfig.compilerOptions.strict;
    delete newConfig.compilerOptions.esModuleInterop;
    delete newConfig.compilerOptions.skipLibCheck;
    delete newConfig.compilerOptions.forceConsistentCasingInFileNames;
    
    fs.writeFileSync(pkgTsConfig, JSON.stringify(newConfig, null, 2));
    console.log(`  ✅ Updated ${pkg} tsconfig\n`);
  }
});

console.log('✅ Build issue fixes complete!');
console.log('\nNext steps:');
console.log('1. Run: pnpm install');
console.log('2. Run: pnpm run build');
console.log('3. Run: pnpm test');