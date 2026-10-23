-- ============================================================================
-- Review-to-Revenue AI Agent SaaS: PostgreSQL Enterprise Relational Schema
-- Version: 2.0.0-PROD
-- Target: PostgreSQL 14+ / Supabase / Neon / AWS RDS / Google Cloud SQL
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean teardown (optional, for migrations)
-- DROP SCHEMA IF EXISTS public CASCADE;
-- CREATE SCHEMA public;

-- ----------------------------------------------------------------------------
-- 1. Organizations (Tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    brand_group VARCHAR(255),
    plan_tier VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'growth', 'pro', 'enterprise')),
    monthly_review_limit INT NOT NULL DEFAULT 500,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Users & Authentication
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'staff' CHECK (role IN ('platform_admin', 'restaurant_owner', 'restaurant_manager', 'outlet_manager', 'staff')),
    avatar_url TEXT,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Organization Members (Tenant Membership & RBAC)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('platform_admin', 'restaurant_owner', 'restaurant_manager', 'outlet_manager', 'staff')),
    assigned_outlet_ids UUID[] DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 4. Outlets (Locations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    time_zone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Integrations & Connectors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL CHECK (provider IN ('google_business', 'slack', 'gmail', 'google_sheets', 'square', 'swiggy', 'zomato', 'webhook')),
    service_id VARCHAR(100), -- viaSocket verified service_id (e.g. rowr707oknl4)
    status VARCHAR(50) NOT NULL DEFAULT 'ready_to_connect' CHECK (status IN ('connected', 'disconnected', 'ready_to_connect', 'error')),
    credentials_encrypted TEXT,
    webhook_secret VARCHAR(255),
    config JSONB DEFAULT '{}'::jsonb,
    last_synced_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. Sync Runs & Ingestion Logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
    source_type VARCHAR(100) NOT NULL CHECK (source_type IN ('google_business', 'csv_upload', 'manual_entry', 'webhook', 'pos_sync')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    records_fetched INT NOT NULL DEFAULT 0,
    records_accepted INT NOT NULL DEFAULT 0,
    records_rejected INT NOT NULL DEFAULT 0,
    records_duplicated INT NOT NULL DEFAULT 0,
    error_report_csv TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 7. Reviews (Normalized Ingestion Model)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    source_platform VARCHAR(100) NOT NULL DEFAULT 'Google' CHECK (source_platform IN ('Google', 'Zomato', 'Swiggy', 'TripAdvisor', 'Direct', 'POS')),
    external_review_id VARCHAR(255),
    reviewer_name VARCHAR(255) DEFAULT 'Anonymous Diner',
    star_rating NUMERIC(2, 1) NOT NULL CHECK (star_rating >= 1.0 AND star_rating <= 5.0),
    review_date DATE NOT NULL,
    review_text TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    source_url TEXT,
    sync_run_id UUID REFERENCES sync_runs(id) ON DELETE SET NULL,
    content_fingerprint VARCHAR(64) NOT NULL, -- SHA-256 for duplicate detection
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, content_fingerprint)
);

-- ----------------------------------------------------------------------------
-- 8. Review Analyses (Structured AI Intelligence)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
    sentiment VARCHAR(50) NOT NULL CHECK (sentiment IN ('Positive', 'Neutral', 'Negative', 'Mixed')),
    confidence_score NUMERIC(3, 2) NOT NULL DEFAULT 0.90,
    primary_category VARCHAR(100) NOT NULL,
    categories TEXT[] NOT NULL DEFAULT '{}',
    primary_issue TEXT,
    secondary_issues TEXT[] DEFAULT '{}',
    mentioned_dish_names TEXT[] DEFAULT '{}',
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('Informational', 'Low', 'Medium', 'High', 'Critical Review Required')),
    urgency VARCHAR(50) NOT NULL CHECK (urgency IN ('Immediate', 'Normal', 'Low')),
    customer_intent VARCHAR(100) DEFAULT 'Feedback',
    factual_summary TEXT,
    evidence_quote TEXT,
    is_uncertain BOOLEAN NOT NULL DEFAULT FALSE,
    food_safety_flag BOOLEAN NOT NULL DEFAULT FALSE,
    suggested_next_action TEXT,
    model_version VARCHAR(100) NOT NULL DEFAULT 'viasocket-gpt-5-mini',
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. Issue Clusters (Complaint Grouping)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_key VARCHAR(255) NOT NULL, -- e.g. "Packaging and leakage :: Butter Chicken"
    category VARCHAR(100) NOT NULL,
    mentioned_dish VARCHAR(255),
    problem_statement TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    priority_score INT NOT NULL CHECK (priority_score >= 0 AND priority_score <= 100),
    priority_level VARCHAR(50) NOT NULL CHECK (priority_level IN ('Critical Priority', 'High Priority', 'Medium Priority', 'Low Priority')),
    priority_explanation TEXT,
    affected_outlet_ids UUID[] DEFAULT '{}',
    total_reviews INT NOT NULL DEFAULT 1,
    average_star_rating NUMERIC(2, 1) NOT NULL DEFAULT 1.0,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'ignored')),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, cluster_key)
);

-- ----------------------------------------------------------------------------
-- 10. Issue Cluster Reviews Junction
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_cluster_reviews (
    issue_cluster_id UUID NOT NULL REFERENCES issue_clusters(id) ON DELETE CASCADE,
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    PRIMARY KEY (issue_cluster_id, review_id)
);

-- ----------------------------------------------------------------------------
-- 11. Root-Cause Investigations (Multi-Step Agent Outputs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS root_cause_investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_cluster_id UUID NOT NULL REFERENCES issue_clusters(id) ON DELETE CASCADE,
    hypotheses JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { rank, title, probability, explanation }
    supporting_evidence TEXT[] DEFAULT '{}',
    contradictory_evidence TEXT[] DEFAULT '{}',
    missing_information TEXT[] DEFAULT '{}',
    verification_steps TEXT[] DEFAULT '{}',
    recommended_sop TEXT,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    investigated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 12. Response Drafts & Approval Queue
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS response_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    draft_text TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft_generated' CHECK (status IN ('draft_generated', 'awaiting_approval', 'approved', 'published', 'failed', 'rejected')),
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    publication_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 13. Improvement Tasks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS improvement_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    issue_cluster_id UUID REFERENCES issue_clusters(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    suggested_resolution TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_role VARCHAR(100) DEFAULT 'Executive Chef',
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_for_verification', 'resolved', 'reopened')),
    verification_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    resolution_notes TEXT,
    post_intervention_rating NUMERIC(2, 1),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 14. Automation Rules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_type VARCHAR(100) NOT NULL CHECK (rule_type IN ('negative_review_alert', 'repeated_complaint_alert', 'daily_report', 'weekly_improvement_report')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. { rating_threshold: 2, severity: 'High' }
    action_config JSONB NOT NULL DEFAULT '{}'::jsonb,  -- e.g. { channel: 'slack', recipient: '#alerts' }
    viasocket_action_id VARCHAR(100),                -- e.g. row1jrbor (Slack Send Message)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 15. Automation Runs (Execution Logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    trigger_event VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed', 'retrying')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 16. Notifications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL CHECK (type IN ('food_safety_alert', 'rating_decline', 'task_assigned', 'report_ready', 'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'normal' CHECK (severity IN ('critical', 'high', 'normal', 'low')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 17. Audit Logs (Immutable Traceability)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 18. Subscription Accounts (Billing & Metering)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    plan_tier VARCHAR(50) NOT NULL DEFAULT 'growth' CHECK (plan_tier IN ('starter', 'growth', 'pro', 'enterprise')),
    monthly_price_inr INT NOT NULL DEFAULT 8999,
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    reviews_analyzed_this_period INT NOT NULL DEFAULT 0,
    reviews_limit INT NOT NULL DEFAULT 1500,
    outlets_count INT NOT NULL DEFAULT 3,
    outlets_limit INT NOT NULL DEFAULT 10,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Indexes for Performance & Scalability
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reviews_org_outlet_date ON reviews(organization_id, outlet_id, review_date DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(star_rating);
CREATE INDEX IF NOT EXISTS idx_review_analyses_sentiment ON review_analyses(sentiment);
CREATE INDEX IF NOT EXISTS idx_review_analyses_category ON review_analyses(primary_category);
CREATE INDEX IF NOT EXISTS idx_review_analyses_safety ON review_analyses(food_safety_flag) WHERE food_safety_flag = TRUE;
CREATE INDEX IF NOT EXISTS idx_issue_clusters_org_score ON issue_clusters(organization_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_org_status ON improvement_tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_date ON audit_logs(organization_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: When running in Supabase / PostgreSQL with JWT auth:
-- CREATE POLICY tenant_isolation_policy ON reviews
--     FOR ALL USING (organization_id = (current_setting('app.current_org_id')::uuid));
