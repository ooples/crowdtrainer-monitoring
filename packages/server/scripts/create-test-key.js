// Quick script to create a test admin key by directly inserting into database
const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function createTestKey() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'monitoring',
    user: 'monitoring_user',
    password: 'monitoring_pass',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const testKey = 'test-admin-key-123456789';
    const hash = await bcrypt.hash(testKey, 12);

    // Insert test API key
    const result = await client.query(`
      INSERT INTO api_keys (name, key_hash, permissions, rate_limit, is_active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, ['Test Admin Key', hash, ['admin', 'read', 'write'], 10000, true]);

    if (result.rows.length > 0) {
      console.log('\n✅ Test admin API key created successfully!');
      console.log(`Key: ${testKey}`);
      console.log(`Use it in requests with header: X-API-Key: ${testKey}`);
    } else {
      console.log('Key may already exist');
    }

  } catch (error) {
    console.error('Error:', error.message);
    
    // Try different database configs if the first one fails
    console.log('\nTrying different database configurations...');
    
    const configs = [
      { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: '' },
      { host: 'localhost', port: 5432, database: 'monitoring', user: 'postgres', password: '' },
      { host: 'localhost', port: 5432, database: 'monitoring_dev', user: 'postgres', password: '' },
    ];
    
    for (const config of configs) {
      try {
        console.log(`Trying ${config.user}@${config.host}:${config.port}/${config.database}`);
        const testClient = new Client(config);
        await testClient.connect();
        console.log('Connected successfully!');
        await testClient.end();
        
        // Use this config to create the key
        const workingClient = new Client(config);
        await workingClient.connect();
        
        const testKey = 'test-admin-key-123456789';
        const hash = await bcrypt.hash(testKey, 12);

        const result = await workingClient.query(`
          INSERT INTO api_keys (name, key_hash, permissions, rate_limit, is_active)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
          RETURNING id
        `, ['Test Admin Key', hash, ['admin', 'read', 'write'], 10000, true]);

        console.log('\n✅ Test admin API key created successfully!');
        console.log(`Key: ${testKey}`);
        console.log(`Use it in requests with header: X-API-Key: ${testKey}`);
        
        await workingClient.end();
        break;
        
      } catch (configError) {
        console.log(`Failed: ${configError.message}`);
        continue;
      }
    }
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

createTestKey();