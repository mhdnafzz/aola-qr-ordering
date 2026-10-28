-- =====================================================================
-- AOLA — WAIT-TIME GAME ENTERPRISE SECURITY & ANTI-CHEAT MIGRATION
-- Run this in your Supabase SQL Editor
-- =====================================================================

-- 1. Game Configuration Table (Stores dynamic daily prize and physics thresholds)
CREATE TABLE IF NOT EXISTS public.game_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default dynamic prize and physics limits
INSERT INTO public.game_config (key, value) VALUES
    ('daily_prize', 'Free Gourmet Sizzling Dessert with Ice Cream'),
    ('min_seconds_per_obstacle', '1.35'),
    ('min_flap_time_ms', '80')
ON CONFLICT (key) DO NOTHING;

-- 2. Game Sessions Table (Single-use cryptographically secured tokens)
CREATE TABLE IF NOT EXISTS public.game_sessions (
    session_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    TEXT NOT NULL,
    table_number TEXT DEFAULT '1',
    nonce       TEXT NOT NULL,
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    consumed    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_order_id ON public.game_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_expires_at ON public.game_sessions(expires_at);

-- 3. Game Leaderboard Table (Daily high scores, sanitized names, and contact for prize redemption)
CREATE TABLE IF NOT EXISTS public.game_leaderboard (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id     TEXT NOT NULL,
    player_name  TEXT NOT NULL,
    contact_info TEXT NOT NULL,
    score        INT NOT NULL CHECK (score >= 0),
    duration_ms  INT NOT NULL CHECK (duration_ms >= 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_leaderboard_score ON public.game_leaderboard(score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_game_leaderboard_created ON public.game_leaderboard(created_at);
CREATE INDEX IF NOT EXISTS idx_game_leaderboard_order_id ON public.game_leaderboard(order_id);

-- Enable RLS
ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_public_read" ON public.game_config FOR SELECT USING (true);
CREATE POLICY "leaderboard_public_read" ON public.game_leaderboard FOR SELECT USING (true);
CREATE POLICY "leaderboard_public_insert" ON public.game_leaderboard FOR INSERT WITH CHECK (score >= 0);
CREATE POLICY "leaderboard_block_update" ON public.game_leaderboard FOR UPDATE USING (false);
CREATE POLICY "leaderboard_block_delete" ON public.game_leaderboard FOR DELETE USING (false);

-- =====================================================================
-- 4. RPC: Start Game Session (The Gatekeeper & Physical Presence Check)
-- Issued exclusively after checkout with a valid order ID & table presence
-- =====================================================================
CREATE OR REPLACE FUNCTION public.start_game_session(
    p_order_id TEXT,
    p_table_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id UUID;
    v_nonce TEXT;
    v_order RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_table TEXT;
BEGIN
    -- Input check
    IF p_order_id IS NULL OR TRIM(p_order_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'code', 'ORDER_REQUIRED', 'message', 'Valid order_id is required.');
    END IF;

    -- Verify order exists in the live database
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = TRIM(p_order_id);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Order not found.');
    END IF;

    -- Check order lifecycle status (must be active in kitchen)
    IF v_order.status IN ('paid', 'Completed', 'completed', 'Deleted', 'Voided') THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ORDER_INACTIVE',
            'message', 'Order is already completed or voided. Arcade is closed for this session.'
        );
    END IF;

    v_table := COALESCE(p_table_number, v_order.table_number, '1');

    -- Physical presence check: table must be specified and non-empty
    IF TRIM(v_table) = '' OR UPPER(TRIM(v_table)) IN ('NONE', 'OFFLINE') THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'PRESENCE_REQUIRED',
            'message', 'Physical presence required: Table QR code must be scanned.'
        );
    END IF;

    -- Generate single-use random crypto nonce
    v_nonce := encode(gen_random_bytes(16), 'hex');

    -- Insert active session
    INSERT INTO public.game_sessions (order_id, table_number, nonce, issued_at, expires_at, consumed)
    VALUES (TRIM(p_order_id), v_table, v_nonce, v_now, v_now + INTERVAL '15 minutes', FALSE)
    RETURNING session_id INTO v_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'sessionId', v_session_id,
        'nonce', v_nonce,
        'table', v_table,
        'issuedAt', extract(epoch from v_now) * 1000
    );
END;
$$;

-- =====================================================================
-- 5. RPC: Check Live Order Queue Status (Dynamic Kitchen Sync)
-- Automatically informs the arcade if food has arrived or order was voided
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_game_order_status(p_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_is_active BOOLEAN;
    v_msg TEXT;
BEGIN
    SELECT id, status, table_number, total_price INTO v_order
    FROM public.orders
    WHERE id = TRIM(p_order_id);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'isActive', false, 'message', 'Order not found.');
    END IF;

    -- Active statuses where customer is still waiting for food
    IF v_order.status IN ('pending', 'new', 'New', 'preparing') THEN
        v_is_active := TRUE;
        v_msg := 'Chef is preparing your hot meal! 🍳';
    ELSIF v_order.status = 'ready' THEN
        v_is_active := TRUE;
        v_msg := 'Your food is plated and ready for pickup! 🛎️';
    ELSIF v_order.status IN ('paid', 'Completed', 'completed') THEN
        v_is_active := FALSE;
        v_msg := 'Your food has arrived at Table ' || v_order.table_number || '! Enjoy your meal. 🍽️';
    ELSE
        v_is_active := FALSE;
        v_msg := 'Order has been cancelled or voided.';
    END IF;

    -- If order is no longer active, burn any pending game sessions for it
    IF NOT v_is_active THEN
        UPDATE public.game_sessions
        SET consumed = TRUE
        WHERE order_id = TRIM(p_order_id);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order.id,
        'status', v_order.status,
        'table', v_order.table_number,
        'isActive', v_is_active,
        'message', v_msg
    );
END;
$$;

-- =====================================================================
-- 6. RPC: Submit Game Score (Strict Anti-Cheat, Velocity, & Staff Exclusions)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.submit_game_score(
    p_session_id UUID,
    p_order_id TEXT,
    p_score INT,
    p_jumps INT,
    p_duration_ms INT,
    p_signature TEXT,
    p_player_name TEXT,
    p_contact TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_order RECORD;
    v_clean_name TEXT;
    v_clean_contact TEXT;
    v_min_seconds_per_obstacle NUMERIC := 1.35;
    v_min_duration_sec NUMERIC;
    v_duration_sec NUMERIC;
    v_new_rank INT;
    v_is_staff BOOLEAN := FALSE;
BEGIN
    -- 1. Anti-Replay: Verify session exists and is unconsumed
    SELECT * INTO v_session
    FROM public.game_sessions
    WHERE session_id = p_session_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_NOT_FOUND', 'message', 'Invalid or expired game session.');
    END IF;

    IF v_session.consumed THEN
        RETURN jsonb_build_object('success', false, 'code', 'REPLAY_BLOCKED', 'message', 'Replay blocked: Single-use token already burned.');
    END IF;

    IF v_session.expires_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED', 'message', 'Game session has expired.');
    END IF;

    IF v_session.order_id <> TRIM(p_order_id) THEN
        RETURN jsonb_build_object('success', false, 'code', 'ORDER_MISMATCH', 'message', 'Order identifier mismatch.');
    END IF;

    -- Invalidate session token immediately
    UPDATE public.game_sessions
    SET consumed = TRUE
    WHERE session_id = p_session_id;

    -- 2. Transaction ID Pairing: Verify real revenue in orders table
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = TRIM(p_order_id);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Transaction ID not found in orders database.');
    END IF;

    -- Check if this order ID has already submitted a score
    IF EXISTS (SELECT 1 FROM public.game_leaderboard WHERE order_id = TRIM(p_order_id)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'TRANSACTION_ALREADY_USED',
            'message', 'Transaction ID already used: Each dining receipt can only submit one high score.'
        );
    END IF;

    -- 3. Staff & POS Test-Order Exclusions
    IF UPPER(TRIM(v_order.table_number)) IN ('TEST', 'STAFF', '0', 'COUNTER', 'POS', 'DEMO', 'ADMIN', 'KITCHEN')
       OR v_order.order_source = 'POS'
       OR v_order.customer_notes LIKE '%[POS]%'
       OR v_order.customer_notes LIKE '%[STAFF]%' THEN
        v_is_staff := TRUE;
    END IF;

    -- 4. Time-Velocity & Physics Feasibility Check
    IF p_score > 0 THEN
        v_duration_sec := p_duration_ms / 1000.0;
        v_min_duration_sec := p_score * v_min_seconds_per_obstacle;

        IF v_duration_sec < v_min_duration_sec THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'SPEED_HACK_DETECTED',
                'message', 'Physics violation: Reported score physically impossible within elapsed duration.'
            );
        END IF;

        -- Jump Count Telemetry Check
        IF p_jumps < FLOOR(p_score * 1.1) THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'TELEMETRY_ANOMALY',
                'message', 'Telemetry anomaly: Insufficient jumps recorded for cleared obstacles.'
            );
        END IF;
    END IF;

    -- If staff order, return score feedback but exclude from public customer prize leaderboard
    IF v_is_staff THEN
        RETURN jsonb_build_object(
            'success', true,
            'isStaff', true,
            'score', p_score,
            'message', 'Great score! (Staff and POS test orders are excluded from customer prize leaderboards).'
        );
    END IF;

    -- 5. Input Sanitization (Defense against XSS)
    v_clean_name := REGEXP_REPLACE(COALESCE(p_player_name, 'Guest'), '[<>&''"]', '', 'g');
    v_clean_name := TRIM(SUBSTRING(v_clean_name FROM 1 FOR 25));
    IF v_clean_name = '' THEN
        v_clean_name := 'Guest Diner';
    END IF;

    v_clean_contact := REGEXP_REPLACE(COALESCE(p_contact, ''), '[<>&''"]', '', 'g');
    v_clean_contact := TRIM(SUBSTRING(v_clean_contact FROM 1 FOR 25));

    -- 6. Record to Public Leaderboard
    INSERT INTO public.game_leaderboard (order_id, player_name, contact_info, score, duration_ms)
    VALUES (TRIM(p_order_id), v_clean_name, v_clean_contact, p_score, p_duration_ms);

    -- Calculate rank today
    SELECT COUNT(*) + 1 INTO v_new_rank
    FROM public.game_leaderboard
    WHERE score > p_score AND created_at >= (NOW() - INTERVAL '24 hours');

    RETURN jsonb_build_object(
        'success', true,
        'rank', v_new_rank,
        'isTopFive', (v_new_rank <= 5),
        'message', 'Score verified and saved to daily leaderboard!'
    );
END;
$$;

-- =====================================================================
-- 7. RPC: Get Daily Leaderboard (Top 5 without exposing contact numbers)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_game_leaderboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prize TEXT := 'Free Specialty Dessert with Ice Cream';
    v_rows JSONB;
BEGIN
    SELECT value INTO v_prize
    FROM public.game_config
    WHERE key = 'daily_prize';

    IF v_prize IS NULL THEN
        v_prize := 'Free Specialty Dessert with Ice Cream';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'rank', row_number() over (ORDER BY score DESC, created_at ASC),
            'playerName', player_name,
            'score', score,
            'createdAt', created_at
        )
    ), '[]'::jsonb) INTO v_rows
    FROM (
        SELECT player_name, score, created_at
        FROM public.game_leaderboard
        WHERE created_at >= (NOW() - INTERVAL '24 hours')
        ORDER BY score DESC, created_at ASC
        LIMIT 5
    ) top5;

    RETURN jsonb_build_object(
        'success', true,
        'dailyPrize', v_prize,
        'leaderboard', v_rows
    );
END;
$$;

-- Grant permissions to public (anon role)
GRANT EXECUTE ON FUNCTION public.start_game_session(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_game_order_status(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_game_score(UUID, TEXT, INT, INT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_leaderboard() TO anon, authenticated;
