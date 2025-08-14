import { Pool, PoolClient, PoolConfig } from 'pg';
import { DatabaseConfig } from '../types';


export class DatabaseManager {
  private pool: Pool;
  private isConnected = false;

  constructor(config: DatabaseConfig) {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      min: config.poolMin,
      max: config.poolMax,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      statement_timeout: 30000,
      query_timeout: 30000,
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err, _client) => {
      console.error('Unexpected database pool error:', err);
    });

    this.pool.on('connect', (_client) => {
      console.log('Database client connected');
    });

    this.pool.on('remove', (_client) => {
      console.log('Database client removed');
    });
  }

  async connect(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      console.log('Database connected successfully');
      
      // Initialize database schema
      await this.initializeSchema();
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log(`Query executed in ${duration}ms:`, text.substring(0, 100));
      return result;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async end(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('Database pool closed');
    }
  }

  private async initializeSchema(): Promise<void> {
    console.log('Initializing database schema...');
    
    try {
      // Enable TimescaleDB extension
      await this.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`);
      
      // Enable UUID extension
      await this.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
      
      // Create API keys table
      await this.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          key_hash VARCHAR(255) UNIQUE NOT NULL,
          permissions TEXT[] NOT NULL DEFAULT '{}',
          rate_limit INTEGER,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_used_at TIMESTAMPTZ,
          is_active BOOLEAN DEFAULT true,
          metadata JSONB DEFAULT '{}'
        )
      `);

      // Create events table with TimescaleDB hypertable
      await this.query(`
        CREATE TABLE IF NOT EXISTS events (
          id UUID DEFAULT uuid_generate_v4(),
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          type VARCHAR(50) NOT NULL,
          level VARCHAR(20) NOT NULL DEFAULT 'info',
          source VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          user_id VARCHAR(255),
          session_id VARCHAR(255),
          request_id VARCHAR(255),
          tags TEXT[] DEFAULT '{}',
          stack TEXT,
          url TEXT,
          user_agent TEXT,
          ip INET,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (id, timestamp)
        )
      `);

      // Convert events to hypertable if not already
      try {
        await this.query(`SELECT create_hypertable('events', 'timestamp', if_not_exists => TRUE)`);
        console.log('Events hypertable created or exists');
      } catch (error) {
        console.warn('Failed to create events hypertable:', error);
      }

      // Create metrics table with TimescaleDB hypertable
      await this.query(`
        CREATE TABLE IF NOT EXISTS metrics (
          id UUID DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          value DOUBLE PRECISION NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          unit VARCHAR(50),
          dimensions JSONB DEFAULT '{}',
          source VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (id, timestamp)
        )
      `);

      // Convert metrics to hypertable if not already
      try {
        await this.query(`SELECT create_hypertable('metrics', 'timestamp', if_not_exists => TRUE)`);
        console.log('Metrics hypertable created or exists');
      } catch (error) {
        console.warn('Failed to create metrics hypertable:', error);
      }

      // Create alerts configuration table
      await this.query(`
        CREATE TABLE IF NOT EXISTS alert_configs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          enabled BOOLEAN DEFAULT true,
          conditions JSONB NOT NULL,
          actions JSONB NOT NULL DEFAULT '[]',
          cooldown INTEGER DEFAULT 300,
          severity VARCHAR(20) DEFAULT 'medium',
          tags TEXT[] DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create alert instances table
      await this.query(`
        CREATE TABLE IF NOT EXISTS alert_instances (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          alert_config_id UUID REFERENCES alert_configs(id) ON DELETE CASCADE,
          triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMPTZ,
          status VARCHAR(20) DEFAULT 'active',
          trigger_value DOUBLE PRECISION,
          message TEXT,
          metadata JSONB DEFAULT '{}'
        )
      `);

      // Create indexes for better performance
      await this.query(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp DESC)`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_events_type ON events (type)`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_events_source ON events (source)`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_events_level ON events (level)`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_events_user_id ON events (user_id)`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING gin(tags)`);
      
      await this.query(`CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics (timestamp DESC)`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics (name)`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_metrics_source ON metrics (source)`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_metrics_dimensions ON metrics USING gin(dimensions)`);
      
      await this.query(`CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configs (enabled)`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_alert_instances_status ON alert_instances (status)`);
      await this.query(`CREATE INDEX IF NOT EXISTS idx_alert_instances_triggered_at ON alert_instances (triggered_at DESC)`);

      // Create compression policy for older data (if TimescaleDB compression is available)
      try {
        await this.query(`
          SELECT add_compression_policy('events', INTERVAL '7 days', if_not_exists => TRUE)
        `);
        await this.query(`
          SELECT add_compression_policy('metrics', INTERVAL '7 days', if_not_exists => TRUE)
        `);
        console.log('Compression policies added');
      } catch (error) {
        console.warn('Failed to add compression policies (TimescaleDB compression may not be available):', error);
      }

      // Create retention policy to automatically drop old data
      try {
        await this.query(`
          SELECT add_retention_policy('events', INTERVAL '30 days', if_not_exists => TRUE)
        `);
        await this.query(`
          SELECT add_retention_policy('metrics', INTERVAL '90 days', if_not_exists => TRUE)
        `);
        console.log('Retention policies added');
      } catch (error) {
        console.warn('Failed to add retention policies:', error);
      }

      // Create materialized views for common aggregations
      await this.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_metrics AS
        SELECT 
          name,
          source,
          time_bucket('1 hour', timestamp) as hour,
          avg(value) as avg_value,
          min(value) as min_value,
          max(value) as max_value,
          count(*) as count
        FROM metrics
        GROUP BY name, source, hour
        WITH NO DATA
      `);

      await this.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS daily_events AS
        SELECT 
          type,
          level,
          source,
          date_trunc('day', timestamp) as day,
          count(*) as event_count
        FROM events
        GROUP BY type, level, source, day
        WITH NO DATA
      `);

      // Create indexes on materialized views
      await this.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_metrics_unique 
                       ON hourly_metrics (name, source, hour)`);
      await this.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_events_unique 
                       ON daily_events (type, level, source, day)`);

      console.log('Database schema initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  // Refresh materialized views (should be called periodically)
  async refreshMaterializedViews(): Promise<void> {
    try {
      await this.query('REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_metrics');
      await this.query('REFRESH MATERIALIZED VIEW CONCURRENTLY daily_events');
      console.log('Materialized views refreshed');
    } catch (error) {
      console.error('Failed to refresh materialized views:', error);
      throw error;
    }
  }
}

let dbManager: DatabaseManager;

export async function initDatabase(config: DatabaseConfig): Promise<DatabaseManager> {
  if (!dbManager) {
    dbManager = new DatabaseManager(config);
    await dbManager.connect();
  }
  return dbManager;
}

export function getDatabase(): DatabaseManager {
  if (!dbManager) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return dbManager;
}

// Migration helper functions
export async function runMigration(name: string, sql: string): Promise<void> {
  console.log(`Running migration: ${name}`);
  
  try {
    // Create migrations table if it doesn't exist
    await dbManager.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Check if migration already applied
    const result = await dbManager.query(
      'SELECT id FROM migrations WHERE name = $1',
      [name]
    );

    if (result.rows.length > 0) {
      console.log(`Migration ${name} already applied, skipping`);
      return;
    }

    // Run migration in transaction
    await dbManager.transaction(async (client) => {
      await client.query(sql);
      await client.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [name]
      );
    });

    console.log(`Migration ${name} applied successfully`);
  } catch (error) {
    console.error(`Migration ${name} failed:`, error);
    throw error;
  }
}