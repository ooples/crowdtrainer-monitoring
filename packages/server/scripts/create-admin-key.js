const { initDatabase } = require('../dist/database/index.js');
const { getAuthManager } = require('../dist/auth/index.js');

async function createAdminKey() {
  try {
    console.log('Creating admin API key...');
    
    // Initialize database connection
    const db = await initDatabase({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT) || 5432,
      database: process.env.DATABASE_NAME || 'monitoring',
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      ssl: false,
      poolMin: 2,
      poolMax: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    console.log('Database connected');
    
    // Create admin API key
    const auth = getAuthManager();
    const result = await auth.generateApiKey(
      'Admin Key',
      ['admin', 'read', 'write'], // Full permissions
      10000, // High rate limit
      undefined // No expiration
    );
    
    console.log('\n✅ Admin API key created successfully!');
    console.log('\nAPI Key Details:');
    console.log(`Name: ${result.apiKey.name}`);
    console.log(`Key: ${result.key}`);
    console.log(`Permissions: ${result.apiKey.permissions.join(', ')}`);
    console.log(`Rate Limit: ${result.apiKey.rateLimit} requests/hour`);
    console.log(`Created: ${result.apiKey.createdAt}`);
    
    console.log('\n📝 Save this API key! You will not be able to see it again.');
    console.log(`Use it in requests with header: X-API-Key: ${result.key}`);
    
    // Close database connection
    await db.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating admin key:', error);
    process.exit(1);
  }
}

createAdminKey();