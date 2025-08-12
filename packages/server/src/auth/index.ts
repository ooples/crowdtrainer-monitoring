import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../database';
import { getRedis } from '../redis';
import { ApiKey, ApiKeySchema } from '../types';

export class AuthManager {
  private db = getDatabase();
  private redis = getRedis();

  // Generate a new API key
  async generateApiKey(
    name: string,
    permissions: string[] = ['read'],
    rateLimit?: number,
    expiresAt?: string
  ): Promise<{ key: string; apiKey: ApiKey }> {
    // Generate a secure random key
    const keyLength = 32;
    const key = randomBytes(keyLength).toString('hex');
    
    // Create a hash of the key for storage
    const hash = await this.hashApiKey(key);
    
    // Prepare API key data
    const apiKeyData = {
      name,
      key, // This won't be stored in DB
      hash,
      permissions,
      rateLimit,
      expiresAt,
      isActive: true,
    };

    // Validate with schema
    const validatedApiKey = ApiKeySchema.parse(apiKeyData);

    // Store in database
    const result = await this.db.query(`
      INSERT INTO api_keys (name, key_hash, permissions, rate_limit, expires_at, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, key_hash as hash, permissions, rate_limit, expires_at, created_at, is_active
    `, [
      validatedApiKey.name,
      validatedApiKey.hash,
      validatedApiKey.permissions,
      validatedApiKey.rateLimit,
      validatedApiKey.expiresAt,
      validatedApiKey.isActive,
    ]);

    const storedApiKey = result.rows[0];
    
    // Cache the API key for faster lookups
    await this.cacheApiKey(storedApiKey);

    return {
      key,
      apiKey: {
        ...storedApiKey,
        key, // Include the actual key in response (only time it's visible)
      },
    };
  }

  // Hash API key for secure storage
  private async hashApiKey(key: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(key, saltRounds);
  }

  // Verify API key against hash
  private async verifyApiKey(key: string, hash: string): Promise<boolean> {
    return bcrypt.compare(key, hash);
  }

  // Authenticate API key from request
  async authenticateApiKey(key: string): Promise<ApiKey | null> {
    if (!key) return null;

    try {
      // Try to get from cache first
      const cached = await this.getCachedApiKey(key);
      if (cached) {
        // Update last used timestamp
        await this.updateLastUsed(cached.id!);
        return cached;
      }

      // If not in cache, query database
      const result = await this.db.query(`
        SELECT id, name, key_hash as hash, permissions, rate_limit, expires_at, 
               created_at, last_used_at, is_active
        FROM api_keys
        WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())
      `);

      for (const row of result.rows) {
        const isValid = await this.verifyApiKey(key, row.hash);
        if (isValid) {
          const apiKey: ApiKey = {
            id: row.id,
            name: row.name,
            key,
            hash: row.hash,
            permissions: row.permissions,
            rateLimit: row.rate_limit,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at,
            isActive: row.is_active,
          };

          // Cache for future use
          await this.cacheApiKey(apiKey);
          
          // Update last used timestamp
          await this.updateLastUsed(apiKey.id!);

          return apiKey;
        }
      }

      return null;
    } catch (error) {
      console.error('Error authenticating API key:', error);
      return null;
    }
  }

  // Cache API key in Redis for faster lookups
  private async cacheApiKey(apiKey: ApiKey): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(apiKey.key);
      const ttl = 3600; // 1 hour cache
      
      await this.redis.setJSON(cacheKey, {
        ...apiKey,
        key: undefined, // Don't cache the actual key
      }, ttl);
    } catch (error) {
      console.error('Error caching API key:', error);
    }
  }

  // Get cached API key
  private async getCachedApiKey(key: string): Promise<ApiKey | null> {
    try {
      const cacheKey = this.getCacheKey(key);
      const cached = await this.redis.getJSON<Partial<ApiKey>>(cacheKey);
      
      if (cached) {
        return { ...cached, key } as ApiKey;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting cached API key:', error);
      return null;
    }
  }

  // Generate cache key for API key
  private getCacheKey(key: string): string {
    // Use hash to avoid storing actual key in cache key
    const hash = createHash('sha256').update(key).digest('hex');
    return `apikey:${hash.substring(0, 16)}`;
  }

  // Update last used timestamp
  private async updateLastUsed(apiKeyId: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE api_keys SET last_used_at = NOW() WHERE id = $1
      `, [apiKeyId]);
    } catch (error) {
      console.error('Error updating last used timestamp:', error);
    }
  }

  // Revoke API key
  async revokeApiKey(apiKeyId: string): Promise<boolean> {
    try {
      const result = await this.db.query(`
        UPDATE api_keys SET is_active = false WHERE id = $1
        RETURNING key_hash
      `, [apiKeyId]);

      if (result.rows.length > 0) {
        // Remove from cache
        const keyHash = result.rows[0].key_hash;
        await this.invalidateCache(keyHash);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error revoking API key:', error);
      return false;
    }
  }

  // Invalidate cache for API key
  private async invalidateCache(keyHash: string): Promise<void> {
    try {
      // We need to find the cache key, which is tricky since we hash the actual key
      // For now, we'll just let it expire naturally or implement a reverse lookup
      console.log('API key cache invalidation requested for hash:', keyHash.substring(0, 8));
    } catch (error) {
      console.error('Error invalidating API key cache:', error);
    }
  }

  // List all API keys (without actual keys)
  async listApiKeys(): Promise<Omit<ApiKey, 'key' | 'hash'>[]> {
    try {
      const result = await this.db.query(`
        SELECT id, name, permissions, rate_limit, expires_at, 
               created_at, last_used_at, is_active
        FROM api_keys
        ORDER BY created_at DESC
      `);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        permissions: row.permissions,
        rateLimit: row.rate_limit,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        isActive: row.is_active,
      }));
    } catch (error) {
      console.error('Error listing API keys:', error);
      return [];
    }
  }

  // Check if API key has required permission
  hasPermission(apiKey: ApiKey, requiredPermission: string): boolean {
    return apiKey.permissions.includes('admin') || 
           apiKey.permissions.includes(requiredPermission);
  }

  // Check rate limit for API key
  async checkRateLimit(apiKey: ApiKey, endpoint: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    try {
      // Use API key specific rate limit or default
      const limit = apiKey.rateLimit || 1000; // Default 1000 requests per hour
      const window = 3600 * 1000; // 1 hour in milliseconds
      
      const rateLimitKey = `ratelimit:${apiKey.id}:${endpoint}`;
      
      return await this.redis.checkRateLimit(rateLimitKey, limit, window);
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // On error, allow the request but log the issue
      return {
        allowed: true,
        remaining: 0,
        resetTime: Date.now() + 3600000,
      };
    }
  }

  // Clean up expired API keys
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await this.db.query(`
        UPDATE api_keys SET is_active = false 
        WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_active = true
      `);

      const count = result.rowCount || 0;
      if (count > 0) {
        console.log(`Cleaned up ${count} expired API keys`);
      }

      return count;
    } catch (error) {
      console.error('Error cleaning up expired API keys:', error);
      return 0;
    }
  }

  // Update API key permissions
  async updateApiKeyPermissions(apiKeyId: string, permissions: string[]): Promise<boolean> {
    try {
      const result = await this.db.query(`
        UPDATE api_keys SET permissions = $1 WHERE id = $2
        RETURNING key_hash
      `, [permissions, apiKeyId]);

      if (result.rows.length > 0) {
        // Invalidate cache
        const keyHash = result.rows[0].key_hash;
        await this.invalidateCache(keyHash);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating API key permissions:', error);
      return false;
    }
  }
}

// Singleton instance
let authManager: AuthManager;

export function getAuthManager(): AuthManager {
  if (!authManager) {
    authManager = new AuthManager();
  }
  return authManager;
}

// Fastify middleware for API key authentication
export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip authentication for health check and docs
  if (request.url === '/health' || request.url.startsWith('/docs')) {
    return;
  }

  const apiKey = request.headers['x-api-key'] as string;
  
  if (!apiKey) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'API key is required',
    });
    return;
  }

  const auth = getAuthManager();
  const validApiKey = await auth.authenticateApiKey(apiKey);

  if (!validApiKey) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  // Check if API key has expired
  if (validApiKey.expiresAt && new Date(validApiKey.expiresAt) < new Date()) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'API key has expired',
    });
    return;
  }

  // Attach API key to request
  request.apiKey = validApiKey;
}

// Middleware to check permissions
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.apiKey) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const auth = getAuthManager();
    if (!auth.hasPermission(request.apiKey, permission)) {
      reply.code(403).send({
        error: 'Forbidden',
        message: `Permission '${permission}' is required`,
      });
      return;
    }
  };
}