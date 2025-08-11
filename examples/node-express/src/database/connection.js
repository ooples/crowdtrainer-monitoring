const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { monitorDatabaseQuery, track } = require('../utils/monitoring');

class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize database connection
   */
  initialize() {
    return new Promise((resolve, reject) => {
      try {
        // Ensure database directory exists
        const dbDir = path.join(__dirname, '../../data');
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }

        const dbPath = path.join(dbDir, 'demo.db');
        
        this.db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            logger.error('Database connection failed:', err);
            reject(err);
            return;
          }

          logger.info(`Connected to SQLite database at ${dbPath}`);
          this.isInitialized = true;
          
          // Initialize tables
          this.initializeTables()
            .then(() => {
              // Track database initialization
              track({
                category: 'database',
                action: 'initialized',
                metadata: {
                  database_path: dbPath,
                  database_type: 'sqlite3',
                },
              });
              resolve();
            })
            .catch(reject);
        });

        // Handle database errors
        this.db.on('error', (err) => {
          logger.error('Database error:', err);
          track({
            category: 'database_error',
            action: 'connection_error',
            metadata: {
              error: err.message,
            },
          });
        });

      } catch (error) {
        logger.error('Failed to initialize database:', error);
        reject(error);
      }
    });
  }

  /**
   * Initialize database tables
   */
  async initializeTables() {
    const tables = [
      {
        name: 'users',
        schema: `
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            is_active BOOLEAN DEFAULT 1
          )
        `,
      },
      {
        name: 'api_keys',
        schema: `
          CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_name TEXT NOT NULL,
            api_key TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            permissions TEXT DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            last_used DATETIME,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `,
      },
      {
        name: 'request_logs',
        schema: `
          CREATE TABLE IF NOT EXISTS request_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            status_code INTEGER,
            duration_ms INTEGER,
            ip_address TEXT,
            user_agent TEXT,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `,
      },
      {
        name: 'webhooks',
        schema: `
          CREATE TABLE IF NOT EXISTS webhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            events TEXT DEFAULT '[]',
            secret TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_triggered DATETIME,
            success_count INTEGER DEFAULT 0,
            failure_count INTEGER DEFAULT 0
          )
        `,
      },
    ];

    for (const table of tables) {
      await this.run(table.schema);
      logger.info(`Table '${table.name}' initialized`);
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key)',
      'CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path)',
      'CREATE INDEX IF NOT EXISTS idx_request_logs_created ON request_logs(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active)',
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    logger.info('Database indexes created');
  }

  /**
   * Execute SQL query with monitoring
   */
  async run(query, params = []) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    return monitorDatabaseQuery(query, () => {
      return new Promise((resolve, reject) => {
        this.db.run(query, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ lastID: this.lastID, changes: this.changes });
          }
        });
      });
    });
  }

  /**
   * Get single row with monitoring
   */
  async get(query, params = []) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    return monitorDatabaseQuery(query, () => {
      return new Promise((resolve, reject) => {
        this.db.get(query, params, (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    });
  }

  /**
   * Get all rows with monitoring
   */
  async all(query, params = []) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    return monitorDatabaseQuery(query, () => {
      return new Promise((resolve, reject) => {
        this.db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    });
  }

  /**
   * Begin transaction
   */
  async beginTransaction() {
    return this.run('BEGIN TRANSACTION');
  }

  /**
   * Commit transaction
   */
  async commitTransaction() {
    return this.run('COMMIT');
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction() {
    return this.run('ROLLBACK');
  }

  /**
   * Execute query within transaction
   */
  async transaction(callback) {
    await this.beginTransaction();
    
    try {
      const result = await callback(this);
      await this.commitTransaction();
      return result;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const tables = ['users', 'api_keys', 'request_logs', 'webhooks'];
    const stats = {};

    for (const table of tables) {
      try {
        const result = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = result.count;
      } catch (error) {
        stats[table] = 0;
      }
    }

    return stats;
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database:', err);
          } else {
            logger.info('Database connection closed');
          }
          this.isInitialized = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;