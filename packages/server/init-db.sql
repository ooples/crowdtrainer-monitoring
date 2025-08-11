-- Initialize TimescaleDB and create initial schema
-- This file is run when the database container starts for the first time

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create API keys table
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
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create metrics table
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unit VARCHAR(50),
    dimensions JSONB DEFAULT '{}',
    source VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create alerts configuration table
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
);

-- Create alert instances table
CREATE TABLE IF NOT EXISTS alert_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_config_id UUID REFERENCES alert_configs(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active',
    trigger_value DOUBLE PRECISION,
    message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Convert tables to hypertables (TimescaleDB)
SELECT create_hypertable('events', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('metrics', 'timestamp', if_not_exists => TRUE);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
CREATE INDEX IF NOT EXISTS idx_events_source ON events (source);
CREATE INDEX IF NOT EXISTS idx_events_level ON events (level);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events (user_id);
CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_events_metadata ON events USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics (name);
CREATE INDEX IF NOT EXISTS idx_metrics_source ON metrics (source);
CREATE INDEX IF NOT EXISTS idx_metrics_dimensions ON metrics USING gin(dimensions);
CREATE INDEX IF NOT EXISTS idx_metrics_name_source_timestamp ON metrics (name, source, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configs (enabled);
CREATE INDEX IF NOT EXISTS idx_alert_instances_status ON alert_instances (status);
CREATE INDEX IF NOT EXISTS idx_alert_instances_triggered_at ON alert_instances (triggered_at DESC);

-- Create materialized views for common aggregations
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
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_events AS
SELECT 
    type,
    level,
    source,
    date_trunc('day', timestamp) as day,
    count(*) as event_count
FROM events
GROUP BY type, level, source, day
WITH NO DATA;

-- Create indexes on materialized views
CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_metrics_unique 
ON hourly_metrics (name, source, hour);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_events_unique 
ON daily_events (type, level, source, day);

-- Set up compression policies (if TimescaleDB compression is available)
DO $$
BEGIN
    -- Add compression policy for events after 7 days
    PERFORM add_compression_policy('events', INTERVAL '7 days', if_not_exists => TRUE);
    -- Add compression policy for metrics after 7 days
    PERFORM add_compression_policy('metrics', INTERVAL '7 days', if_not_exists => TRUE);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Compression policies not available or already exist';
END
$$;

-- Set up retention policies
DO $$
BEGIN
    -- Events retained for 30 days
    PERFORM add_retention_policy('events', INTERVAL '30 days', if_not_exists => TRUE);
    -- Metrics retained for 90 days
    PERFORM add_retention_policy('metrics', INTERVAL '90 days', if_not_exists => TRUE);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Retention policies not available or already exist';
END
$$;

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_monitoring_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_events;
END;
$$ LANGUAGE plpgsql;

-- Set up cron job to refresh materialized views every hour (if pg_cron is available)
DO $$
BEGIN
    -- This requires pg_cron extension
    PERFORM cron.schedule('refresh-monitoring-views', '0 * * * *', 'SELECT refresh_monitoring_views();');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron extension not available - materialized views need manual refresh';
END
$$;

-- Insert sample data for testing (optional)
INSERT INTO api_keys (name, key_hash, permissions) VALUES 
('Development Key', '$2b$12$sample.hash.for.development.key.only', ARRAY['read', 'write'])
ON CONFLICT DO NOTHING;

-- Create sample alert configuration
INSERT INTO alert_configs (name, description, conditions, actions, severity) VALUES 
(
    'High Error Rate',
    'Alert when error rate exceeds 5%',
    '{"metric": "error_rate", "operator": "gt", "threshold": 5, "timeWindow": 300}',
    '[{"type": "webhook", "endpoint": "http://localhost:3001/webhooks/alerts"}]',
    'high'
) ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO monitoring_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO monitoring_user;

-- Create monitoring user if it doesn't exist (for manual setup)
DO $$
BEGIN
    CREATE USER monitoring_user WITH PASSWORD 'monitoring_password';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'User monitoring_user already exists';
END
$$;

-- Final notification
SELECT 'TimescaleDB monitoring database initialized successfully!' as status;