import { getAuthManager } from './auth';
import { getDatabase } from './database';

export async function initializeAdminApiKey(): Promise<void> {
  const adminKey = process.env.ADMIN_API_KEY;
  
  if (!adminKey) {
    console.log('No ADMIN_API_KEY configured, skipping admin key initialization');
    return;
  }

  try {
    const auth = getAuthManager();
    const db = getDatabase();
    
    // Check if an admin key already exists
    const existingKeys = await db.query(`
      SELECT id, name FROM api_keys 
      WHERE name = 'Dashboard Admin' 
      AND is_active = true
    `);
    
    if (existingKeys.rows.length > 0) {
      console.log('Admin API key already exists');
      return;
    }
    
    // Create the admin API key with full permissions
    const { apiKey } = await auth.generateApiKey(
      'Dashboard Admin',
      ['read', 'write', 'admin'],
      10000, // High rate limit for admin
      undefined // No expiration
    );
    
    // Update the key to match our configured admin key
    // This is a special case for the admin key
    await db.query(`
      UPDATE api_keys 
      SET key_hash = crypt($1, gen_salt('bf', 12))
      WHERE id = $2
    `, [adminKey, apiKey.id]);
    
    console.log('✓ Admin API key initialized successfully');
    console.log(`  Name: ${apiKey.name}`);
    console.log(`  Permissions: ${apiKey.permissions.join(', ')}`);
    console.log(`  Rate Limit: ${apiKey.rateLimit} requests/hour`);
    
  } catch (error) {
    console.error('Failed to initialize admin API key:', error);
    // Non-fatal error, server can continue
  }
}