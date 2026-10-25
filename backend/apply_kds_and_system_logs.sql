-- =====================================================================
-- AOLA POS — MASTER PRODUCTION MIGRATION
-- Run this script in your Supabase SQL Editor:
-- Supabase Dashboard -> Project -> SQL Editor -> New Query -> Run
-- 
-- Resolves:
-- 1. "orders_status_check" constraint violation on order updates
-- 2. Enables KDS lifecycle: Customer ('pending') -> Kitchen ('ready') -> Cashier ('paid')
-- 3. Cleans legacy [KDS:READY] tags from customer_notes and moves to 'ready'
-- 4. Creates persistent 'system_logs' table for the System Health & Error Console
-- =====================================================================

-- ── 1. KDS WORKFLOW: ORDERS TABLE STATUS CONSTRAINT ───────────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders 
  ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'ready', 'paid', 'New', 'Completed', 'Deleted', 'Voided'));

-- Set default status for new incoming customer/POS orders
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';

-- Migrate existing [KDS:READY] tagged orders directly to 'ready' status
UPDATE public.orders 
SET status = 'ready', 
    customer_notes = TRIM(REPLACE(customer_notes, '[KDS:READY]', ''))
WHERE customer_notes LIKE '%[KDS:READY]%';

-- Migrate legacy status labels to modern KDS workflow
UPDATE public.orders SET status = 'pending' WHERE status = 'New';
UPDATE public.orders SET status = 'paid' WHERE status = 'Completed';

-- Index for high-speed kitchen and cashier queue filtering
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON public.orders(shop_id, status);


-- ── 2. SYSTEM HEALTH & ERROR TELEMETRY CONSOLE ─────────────────────────
-- Creates persistent system_logs table with 30-day retention
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

-- Fast lookup indexes for admin error monitoring
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_shop_created ON public.system_logs(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level_created ON public.system_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_action ON public.system_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_session ON public.system_logs(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation
DROP POLICY IF EXISTS "anon_insert_logs" ON public.system_logs;
DROP POLICY IF EXISTS "anon_read_logs"   ON public.system_logs;
DROP POLICY IF EXISTS "anon_all_logs"    ON public.system_logs;

-- Allow client frontend (anonymous publishable key) to insert sanitized logs
CREATE POLICY "anon_insert_logs" ON public.system_logs
    FOR INSERT WITH CHECK (true);

-- Allow reading logs for Health Console in admin portal
CREATE POLICY "anon_read_logs" ON public.system_logs
    FOR SELECT USING (true);

-- Optional: 30-Day Log Retention Cleanup Function
CREATE OR REPLACE FUNCTION public.cleanup_old_logs(p_retention_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.system_logs
    WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

COMMENT ON TABLE public.system_logs IS 'Persistent 30-day telemetry, security audit trail, and error tracking for AOLA POS';
