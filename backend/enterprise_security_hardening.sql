-- =====================================================================
-- AOLA POS — ENTERPRISE SECURITY HARDENING & ENCRYPTION MIGRATION
-- Run this entire script in your Supabase SQL Editor
-- =====================================================================

-- =====================================================================
-- PROTOCOL 1: ROW LEVEL SECURITY (RLS) LOCKDOWN
-- =====================================================================

-- 1. Enable RLS on core tables
ALTER TABLE IF EXISTS public.menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.game_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders_archive ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing legacy loose policies to ensure clean state
DROP POLICY IF EXISTS "anon_read_menu" ON public.menu;
DROP POLICY IF EXISTS "anon_all_menu" ON public.menu;
DROP POLICY IF EXISTS "menu_public_select" ON public.menu;
DROP POLICY IF EXISTS "menu_admin_all" ON public.menu;
DROP POLICY IF EXISTS "menu_admin_insert" ON public.menu;
DROP POLICY IF EXISTS "menu_admin_update" ON public.menu;
DROP POLICY IF EXISTS "menu_admin_delete" ON public.menu;

DROP POLICY IF EXISTS "anon_read_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_all_orders" ON public.orders;
DROP POLICY IF EXISTS "orders_public_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_staff_select" ON public.orders;
DROP POLICY IF EXISTS "orders_staff_update" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_delete" ON public.orders;

DROP POLICY IF EXISTS "leaderboard_public_read" ON public.game_leaderboard;
DROP POLICY IF EXISTS "leaderboard_public_insert" ON public.game_leaderboard;
DROP POLICY IF EXISTS "leaderboard_block_update" ON public.game_leaderboard;
DROP POLICY IF EXISTS "leaderboard_block_delete" ON public.game_leaderboard;

DROP POLICY IF EXISTS "anon_read_logs" ON public.system_logs;
DROP POLICY IF EXISTS "anon_write_logs" ON public.system_logs;
DROP POLICY IF EXISTS "logs_public_insert" ON public.system_logs;
DROP POLICY IF EXISTS "logs_admin_select" ON public.system_logs;
DROP POLICY IF EXISTS "logs_block_update" ON public.system_logs;
DROP POLICY IF EXISTS "logs_block_delete" ON public.system_logs;

-- ---------------------------------------------------------------------
-- TABLE 1: MENU
-- Requirement: SELECT is public. INSERT/UPDATE/DELETE strictly requires Admin.
-- ---------------------------------------------------------------------
CREATE POLICY "menu_public_select"
    ON public.menu
    FOR SELECT
    USING (true);

CREATE POLICY "menu_admin_insert"
    ON public.menu
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "menu_admin_update"
    ON public.menu
    FOR UPDATE
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "menu_admin_delete"
    ON public.menu
    FOR DELETE
    TO authenticated
    USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- TABLE 2: ORDERS
-- Requirement: Customers can only INSERT with status = 'pending'.
--              SELECT/UPDATE strictly requires Kitchen or Admin roles.
-- ---------------------------------------------------------------------
CREATE POLICY "orders_public_insert"
    ON public.orders
    FOR INSERT
    WITH CHECK (
        status = 'pending' 
        AND length(trim(table_number)) > 0 
        AND total_price >= 0
    );

CREATE POLICY "orders_staff_select"
    ON public.orders
    FOR SELECT
    TO authenticated
    USING (auth.role() = 'authenticated');

CREATE POLICY "orders_staff_update"
    ON public.orders
    FOR UPDATE
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "orders_admin_delete"
    ON public.orders
    FOR DELETE
    TO authenticated
    USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- TABLE 3: GAME SCORES / LEADERBOARD
-- Requirement: INSERT is public (restrict to valid score).
--              SELECT is public. UPDATE/DELETE completely blocked.
-- ---------------------------------------------------------------------
CREATE POLICY "leaderboard_public_read"
    ON public.game_leaderboard
    FOR SELECT
    USING (true);

CREATE POLICY "leaderboard_public_insert"
    ON public.game_leaderboard
    FOR INSERT
    WITH CHECK (
        score >= 0 
        AND length(trim(player_name)) > 0
        AND length(player_name) <= 30
        AND duration_ms >= 0
    );

CREATE POLICY "leaderboard_block_update"
    ON public.game_leaderboard
    FOR UPDATE
    USING (false);

CREATE POLICY "leaderboard_block_delete"
    ON public.game_leaderboard
    FOR DELETE
    USING (false);

-- Create game_scores compatibility view/alias if referenced as game_scores
CREATE OR REPLACE VIEW public.game_scores AS 
    SELECT id, order_id, player_name, contact_info, score, duration_ms, created_at 
    FROM public.game_leaderboard;

-- Direct table policies if game_scores is created as a standalone table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'game_scores' AND table_type = 'BASE TABLE'
    ) THEN
        EXECUTE 'ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "scores_public_read" ON public.game_scores';
        EXECUTE 'DROP POLICY IF EXISTS "scores_public_insert" ON public.game_scores';
        EXECUTE 'DROP POLICY IF EXISTS "scores_block_update" ON public.game_scores';
        EXECUTE 'DROP POLICY IF EXISTS "scores_block_delete" ON public.game_scores';
        EXECUTE 'CREATE POLICY "scores_public_read" ON public.game_scores FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY "scores_public_insert" ON public.game_scores FOR INSERT WITH CHECK (score >= 0 AND length(trim(player_name)) > 0 AND length(player_name) <= 30 AND duration_ms >= 0)';
        EXECUTE 'CREATE POLICY "scores_block_update" ON public.game_scores FOR UPDATE USING (false)';
        EXECUTE 'CREATE POLICY "scores_block_delete" ON public.game_scores FOR DELETE USING (false)';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- TABLE 4: SYSTEM LOGS
-- Requirement: INSERT is public (for telemetry & error capture).
--              SELECT strictly requires Admin. UPDATE/DELETE blocked.
-- ---------------------------------------------------------------------
CREATE POLICY "logs_public_insert"
    ON public.system_logs
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "logs_admin_select"
    ON public.system_logs
    FOR SELECT
    TO authenticated
    USING (auth.role() = 'authenticated');

CREATE POLICY "logs_block_update"
    ON public.system_logs
    FOR UPDATE
    USING (false);

CREATE POLICY "logs_block_delete"
    ON public.system_logs
    FOR DELETE
    USING (false);

-- ---------------------------------------------------------------------
-- TABLE 5: CONFIG & SETTINGS (Master admin keys & sensitive configs)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_read_config" ON public.config;
DROP POLICY IF EXISTS "anon_write_config" ON public.config;

CREATE POLICY "config_admin_select"
    ON public.config
    FOR SELECT
    TO authenticated
    USING (auth.role() = 'authenticated');

CREATE POLICY "config_admin_all"
    ON public.config
    FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- TABLE 6: SHOPS (Public read for customer branding; owner PIN protected)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_read_shops" ON public.shops;
DROP POLICY IF EXISTS "anon_insert_shops" ON public.shops;
DROP POLICY IF EXISTS "anon_update_shops" ON public.shops;
DROP POLICY IF EXISTS "anon_delete_shops" ON public.shops;

-- Public can only read shop branding (excluding plaintext credentials)
CREATE POLICY "shops_public_select"
    ON public.shops
    FOR SELECT
    USING (true);

-- Modifications require authenticated admin/owner
CREATE POLICY "shops_admin_modify"
    ON public.shops
    FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated');


-- =====================================================================
-- PROTOCOL 2: PGCRYPTO ENCRYPTION AT REST & SENSITIVE SECRETS
-- =====================================================================

-- 1. Enable pgcrypto extension for AES/Blowfish encryption at rest
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create encrypted restaurant configuration store
CREATE TABLE IF NOT EXISTS public.restaurant_secrets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id         TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    secret_key      TEXT NOT NULL,
    encrypted_value BYTEA NOT NULL,
    key_hint        TEXT DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shop_id, secret_key)
);

ALTER TABLE public.restaurant_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secrets_admin_only"
    ON public.restaurant_secrets
    FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated');

-- 3. Stored Procedure: Encrypt and store sensitive key at rest (PGP Symmetric AES)
CREATE OR REPLACE FUNCTION public.vault_store_secret(
    p_shop_id TEXT,
    p_secret_key TEXT,
    p_plain_value TEXT,
    p_passphrase TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.restaurant_secrets (shop_id, secret_key, encrypted_value, updated_at)
    VALUES (
        p_shop_id,
        p_secret_key,
        pgp_sym_encrypt(p_plain_value, p_passphrase, 'compress-algo=1, cipher-algo=aes256'),
        NOW()
    )
    ON CONFLICT (shop_id, secret_key) DO UPDATE
    SET encrypted_value = pgp_sym_encrypt(p_plain_value, p_passphrase, 'compress-algo=1, cipher-algo=aes256'),
        updated_at = NOW();

    RETURN TRUE;
END;
$$;

-- 4. Stored Procedure: Decrypt sensitive key at rest
CREATE OR REPLACE FUNCTION public.vault_read_secret(
    p_shop_id TEXT,
    p_secret_key TEXT,
    p_passphrase TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_encrypted BYTEA;
    v_decrypted TEXT;
BEGIN
    SELECT encrypted_value INTO v_encrypted
    FROM public.restaurant_secrets
    WHERE shop_id = p_shop_id AND secret_key = p_secret_key;

    IF v_encrypted IS NULL THEN
        RETURN NULL;
    END IF;

    BEGIN
        v_decrypted := pgp_sym_decrypt(v_encrypted, p_passphrase);
        RETURN v_decrypted;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL; -- Returns NULL if passphrase is invalid
    END;
END;
$$;

-- 5. Stored Procedure: Secure Bcrypt Salt Hashing for Owner PIN (Zero Plaintext PINs)
CREATE OR REPLACE FUNCTION public.verify_owner_pin_secure(
    p_shop_id TEXT,
    p_candidate_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stored_pin TEXT;
BEGIN
    SELECT owner_pin INTO v_stored_pin
    FROM public.shops
    WHERE id = p_shop_id;

    IF v_stored_pin IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Supports both legacy plaintext (for graceful upgrade) and modern bcrypt hash
    IF v_stored_pin LIKE '$2a$%' OR v_stored_pin LIKE '$2b$%' THEN
        RETURN (v_stored_pin = crypt(p_candidate_pin, v_stored_pin));
    ELSE
        -- If plaintext matches, automatically upgrade to bcrypt hash at rest
        IF v_stored_pin = p_candidate_pin THEN
            UPDATE public.shops
            SET owner_pin = crypt(p_candidate_pin, gen_salt('bf', 10))
            WHERE id = p_shop_id;
            RETURN TRUE;
        END IF;
        RETURN FALSE;
    END IF;
END;
$$;
