-- =====================================================================
-- AOLA — Kitchen Display System (KDS) & Order Status Lifecycle Migration
-- Migration Script: Execute in Supabase SQL Editor
-- 
-- Complete Flow:
-- 1. Customer / POS orders  -> status = 'pending'
-- 2. Kitchen prepares order -> status = 'ready'
-- 3. Cashier bills / pays   -> status = 'paid'
-- =====================================================================

-- Step 1: Update Check Constraint on public.orders table
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders 
  ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'ready', 'paid', 'New', 'Completed', 'Deleted', 'Voided'));

-- Step 2: Set Default Column Value to 'pending'
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';

-- Step 3: Migrate existing historical rows safely
UPDATE public.orders SET status = 'pending' WHERE status = 'New';
UPDATE public.orders SET status = 'paid' WHERE status = 'Completed';

-- Step 4: Ensure index on status for high-speed kitchen and cashier queue filtering
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON public.orders(shop_id, status);

-- Step 5: Update place_order Stored Procedure to insert new orders with status = 'pending'
CREATE OR REPLACE FUNCTION public.place_order(
    p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_shop_id       TEXT;
    v_table_number  TEXT;
    v_notes         TEXT;
    v_source        TEXT;
    v_item          JSONB;
    v_menu_row      RECORD;
    v_qty           INT;
    v_line_total    NUMERIC(10,2);
    v_grand_total   NUMERIC(10,2) := 0;
    v_verified      JSONB := '[]'::jsonb;
    v_summary       TEXT  := '';
    v_order_id      TEXT;
    v_shop_row      public.shops%ROWTYPE;
    v_currency      TEXT;
    v_status        TEXT;
BEGIN
    v_shop_id      := LOWER(TRIM(p_payload->>'shop_id'));
    v_table_number := COALESCE(TRIM(p_payload->>'table_number'), '1');
    v_notes        := COALESCE(TRIM(p_payload->>'customer_notes'), '');
    v_source       := COALESCE(TRIM(p_payload->>'order_source'), 'QR');
    v_status       := COALESCE(NULLIF(TRIM(p_payload->>'status'), ''), 'pending');

    SELECT * INTO v_shop_row FROM public.shops WHERE id = v_shop_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Restaurant not found.');
    END IF;
    IF v_shop_row.status != 'Active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Restaurant ordering is currently suspended.');
    END IF;
    v_currency := v_shop_row.currency;

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

-- Step 6: Ensure Realtime Publication is active for orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
