-- =====================================================================
-- AOLA — Production System Logging & Error Tracking Schema
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- Creates the persistent 'system_logs' table with 30-day retention
-- =====================================================================

-- 1. Create system_logs table
CREATE TABLE IF NOT EXISTS public.system_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shop_id        TEXT NOT NULL DEFAULT 'system',
    session_id     TEXT DEFAULT '',
    user_role      TEXT DEFAULT 'guest',
    level          TEXT NOT NULL DEFAULT 'INFO'
                   CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')),
    action         TEXT NOT NULL,
    message        TEXT NOT NULL,
    page           TEXT DEFAULT '',
    user_agent     TEXT DEFAULT '',
    meta           JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_details  JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 2. Indexes for fast dashboard filtering & 30-day queries
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_shop_created ON public.system_logs(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level_created ON public.system_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_action ON public.system_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_session ON public.system_logs(session_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (idempotent)
DROP POLICY IF EXISTS "anon_insert_logs" ON public.system_logs;
DROP POLICY IF EXISTS "anon_read_logs"   ON public.system_logs;
DROP POLICY IF EXISTS "anon_all_logs"    ON public.system_logs;

-- Allow client frontend (anonymous publishable key) to securely insert sanitized logs
CREATE POLICY "anon_insert_logs" ON public.system_logs
    FOR INSERT WITH CHECK (true);

-- Allow reading logs for dashboard analysis
CREATE POLICY "anon_read_logs" ON public.system_logs
    FOR SELECT USING (true);

-- 4. Automatic 30-Day Log Retention Cleanup Function
CREATE OR REPLACE FUNCTION public.cleanup_old_logs(p_retention_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.system_logs
    WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Grant execution to authenticated & anon roles for automated maintenance
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs(INT) TO anon, authenticated, service_role;

COMMENT ON TABLE public.system_logs IS 'Persistent 30-day telemetry, security audit trail, and error tracking for AOLA POS';
