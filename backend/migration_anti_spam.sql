-- =====================================================================
-- AOLA — Anti-Spam & DoS Flood Protection Migration
-- Migration Script: Execute in Supabase SQL Editor
--
-- Features:
-- 1. Honeypot & Table Cooldown (45 seconds between QR orders per table)
-- 2. Maximum Active Unbilled Orders Cap (Max 4 active orders per table)
-- 3. Batch Void Stored Procedure for instant spam cleanup by restaurant owner
-- =====================================================================

-- Step 1: Update place_order stored procedure with server-side Anti-Spam throttle
CREATE OR REPLACE FUNCTION public.place_order(
    p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_shop_id             TEXT;
    v_table_number        TEXT;
    v_notes               TEXT;
    v_source              TEXT;
    v_status              TEXT;
    v_honeypot            TEXT;
    v_item                JSONB;
    v_menu_row            RECORD;
    v_qty                 INT;
    v_line_total          NUMERIC(10,2);
    v_grand_total         NUMERIC(10,2) := 0;
    v_verified            JSONB := '[]'::jsonb;
    v_summary             TEXT  := '';
    v_order_id            TEXT;
    v_shop_row            public.shops%ROWTYPE;
    v_currency            TEXT;
    v_active_order_count  INT;
    v_last_order_time     TIMESTAMPTZ;
    v_seconds_elapsed     INT;
BEGIN
    v_shop_id      := LOWER(TRIM(p_payload->>'shop_id'));
    v_table_number := COALESCE(TRIM(p_payload->>'table_number'), '1');
    v_notes        := COALESCE(TRIM(p_payload->>'customer_notes'), '');
    v_source       := COALESCE(TRIM(p_payload->>'order_source'), 'QR');
    v_status       := COALESCE(NULLIF(TRIM(p_payload->>'status'), ''), 'pending');
    v_honeypot     := COALESCE(TRIM(p_payload->>'customer_fax'), TRIM(p_payload->>'honeypot'), '');

    -- 1. Honeypot Bot Trap Check
    IF v_honeypot != '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bot activity detected and rejected.');
    END IF;

    -- 2. Validate Restaurant Tenant
    SELECT * INTO v_shop_row FROM public.shops WHERE id = v_shop_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Restaurant not found.');
    END IF;
    IF v_shop_row.status != 'Active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Restaurant ordering is currently suspended.');
    END IF;
    v_currency := v_shop_row.currency;

    -- 3. Anti-Spam & DoS Flood Controls (Applies to customer QR orders; POS exempt)
    IF v_source != 'POS' THEN
        -- 3a. Cooldown check: Has this table ordered in the last 45 seconds?
        SELECT created_at INTO v_last_order_time
        FROM public.orders
        WHERE shop_id = v_shop_id
          AND table_number = v_table_number
          AND status IN ('pending', 'new', 'New', 'ready')
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_last_order_time IS NOT NULL THEN
            v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_last_order_time))::INT;
            IF v_seconds_elapsed < 45 THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Anti-Spam Cooldown: Table ' || v_table_number || ' ordered ' || v_seconds_elapsed || 's ago. Please wait ' || (45 - v_seconds_elapsed) || 's before sending additional items.'
                );
            END IF;
        END IF;

        -- 3b. Active Orders Cap: Maximum 4 active unbilled orders per table
        SELECT COUNT(*) INTO v_active_order_count
        FROM public.orders
        WHERE shop_id = v_shop_id
          AND table_number = v_table_number
          AND status IN ('pending', 'new', 'New', 'ready');

        IF v_active_order_count >= 4 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Table ' || v_table_number || ' already has ' || v_active_order_count || ' active unbilled orders. Please ask the cashier to bill your current items before ordering more.'
            );
        END IF;
    END IF;

    -- 4. Verify items and calculate server-side pricing
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
    LOOP
        SELECT * INTO v_menu_row
        FROM public.menu
        WHERE id = TRIM(v_item->>'id') AND shop_id = v_shop_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false,
                'error', 'Menu item ''' || COALESCE(v_item->>'id','?') || ''' not found.');
        END IF;

        IF NOT v_menu_row.in_stock THEN
            RETURN jsonb_build_object('success', false,
                'error', 'Item ''' || v_menu_row.name || ''' is currently out of stock.');
        END IF;

        v_qty := GREATEST(1, COALESCE((v_item->>'qty')::int, 1));
        v_line_total := v_menu_row.price * v_qty;
        v_grand_total := v_grand_total + v_line_total;

        v_verified := v_verified || jsonb_build_object(
            'dishId',    v_menu_row.id,
            'name',      v_menu_row.name,
            'qty',       v_qty,
            'unitPrice', v_menu_row.price,
            'lineTotal', v_line_total
        );

        IF v_summary != '' THEN v_summary := v_summary || ', '; END IF;
        v_summary := v_summary || v_qty || 'x ' || v_menu_row.name
                      || ' (' || v_currency || TRIM(TO_CHAR(v_line_total, '999999990.00')) || ')';
    END LOOP;

    v_order_id := 'ORD-' || LPAD(FLOOR(RANDOM()*9000+1000)::text, 4, '0');

    -- Insert into public.orders with initial status = 'pending'
    INSERT INTO public.orders (id, shop_id, table_number, items, items_summary, total_price, status, customer_notes, order_source)
    VALUES (v_order_id, v_shop_id, v_table_number, v_verified, v_summary, v_grand_total, v_status, v_notes, v_source);

    RETURN jsonb_build_object(
        'success',            true,
        'order_id',           v_order_id,
        'table_number',       v_table_number,
        'total_price',        v_grand_total,
        'currency',           v_currency,
        'status',             v_status,
        'verified_by_server', true,
        'message',            'Order placed successfully and sent to kitchen queue.'
    );
END;
$$;

-- Step 2: Batch Void Stored Procedure for Instant Spam Flood Mitigation
CREATE OR REPLACE FUNCTION public.void_table_orders(
    p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_shop_id       TEXT;
    v_table_number  TEXT;
    v_pin           TEXT;
    v_reason        TEXT;
    v_shop_row      public.shops%ROWTYPE;
    v_voided_count  INT := 0;
BEGIN
    v_shop_id      := LOWER(TRIM(p_payload->>'shop_id'));
    v_table_number := TRIM(p_payload->>'table_number');
    v_pin          := TRIM(p_payload->>'pin');
    v_reason       := COALESCE(TRIM(p_payload->>'reason'), 'Batch Voided / Spam Mitigation');

    IF v_table_number = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Table number is required.');
    END IF;

    SELECT * INTO v_shop_row FROM public.shops WHERE id = v_shop_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Restaurant not found.');
    END IF;

    -- Verify Owner PIN
    IF v_pin IS NOT NULL AND v_pin != '' THEN
        IF v_shop_row.owner_pin != v_pin THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid security PIN.');
        END IF;
    END IF;

    -- Batch update active orders to Deleted
    WITH updated AS (
        UPDATE public.orders
        SET status = 'Deleted',
            customer_notes = CASE 
                WHEN customer_notes IS NULL OR customer_notes = '' THEN '[BATCH VOIDED: ' || v_reason || ']'
                ELSE customer_notes || ' | [BATCH VOIDED: ' || v_reason || ']'
            END
        WHERE shop_id = v_shop_id
          AND table_number = v_table_number
          AND status IN ('pending', 'new', 'New', 'ready')
        RETURNING id
    )
    SELECT COUNT(*) INTO v_voided_count FROM updated;

    RETURN jsonb_build_object(
        'success',      true,
        'table_number', v_table_number,
        'count',        v_voided_count,
        'message',      'Successfully voided ' || v_voided_count || ' orders for Table ' || v_table_number || '.'
    );
END;
$$;
