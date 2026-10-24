-- =====================================================================
-- AOLA — Complete Supabase Production Migration SQL
-- Paste this entire file into your Supabase SQL Editor and click "Run"
-- =====================================================================

-- =====================================================================
-- SECTION 1: DROP OLD OBJECTS (safe re-run / idempotent)
-- =====================================================================
DROP FUNCTION IF EXISTS public.place_order(jsonb);
DROP FUNCTION IF EXISTS public.verify_owner_pin(text, text);
DROP FUNCTION IF EXISTS public.change_owner_pin(text, text, text);
DROP FUNCTION IF EXISTS public.archive_old_orders(text, int);

-- =====================================================================
-- SECTION 2: TABLES
-- =====================================================================

-- 2a. Config — stores master admin PIN and global settings
CREATE TABLE IF NOT EXISTS public.config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);

-- 2b. Shops — one row per restaurant tenant
CREATE TABLE IF NOT EXISTS public.shops (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    logo_url   TEXT DEFAULT '',
    owner_pin  TEXT NOT NULL DEFAULT '1234',
    status     TEXT NOT NULL DEFAULT 'Active'
        CHECK (status IN ('Active','Suspended')),
    currency   TEXT NOT NULL DEFAULT '₹',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2c. Menu — dishes belonging to a shop
CREATE TABLE IF NOT EXISTS public.menu (
    id          TEXT PRIMARY KEY,
    shop_id     TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'Mains',
    description TEXT DEFAULT '',
    price       NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    is_veg      BOOLEAN NOT NULL DEFAULT FALSE,
    in_stock    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2d. Orders — live order queue
CREATE TABLE IF NOT EXISTS public.orders (
    id             TEXT PRIMARY KEY,
    shop_id        TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    table_number   TEXT NOT NULL DEFAULT '1',
    items          JSONB NOT NULL DEFAULT '[]'::jsonb,
    items_summary  TEXT DEFAULT '',
    total_price    NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status         TEXT NOT NULL DEFAULT 'New'
        CHECK (status IN ('New','Completed','Deleted','Voided')),
    customer_notes TEXT DEFAULT '',
    order_source   TEXT DEFAULT 'QR',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2e. Expenses — daily expense ledger
CREATE TABLE IF NOT EXISTS public.expenses (
    id          TEXT PRIMARY KEY,
    shop_id     TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    category    TEXT NOT NULL DEFAULT 'Supplies',
    description TEXT NOT NULL DEFAULT '',
    amount      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2f. Settings — per-shop store profile & receipt settings
CREATE TABLE IF NOT EXISTS public.settings (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shop_id    TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    key        TEXT NOT NULL,
    value      TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shop_id, key)
);

-- 2g. Orders Archive — completed/old orders moved here for performance
CREATE TABLE IF NOT EXISTS public.orders_archive (
    id             TEXT PRIMARY KEY,
    shop_id        TEXT NOT NULL,
    table_number   TEXT DEFAULT '1',
    items          JSONB DEFAULT '[]'::jsonb,
    items_summary  TEXT DEFAULT '',
    total_price    NUMERIC(10,2) DEFAULT 0.00,
    status         TEXT DEFAULT 'Completed',
    customer_notes TEXT DEFAULT '',
    order_source   TEXT DEFAULT 'QR',
    created_at     TIMESTAMPTZ,
    archived_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- SECTION 3: INDEXES (fast lookups for production)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_menu_shop       ON public.menu(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop     ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created  ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_shop   ON public.expenses(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date   ON public.expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_shop   ON public.settings(shop_id);
CREATE INDEX IF NOT EXISTS idx_archive_shop    ON public.orders_archive(shop_id);
CREATE INDEX IF NOT EXISTS idx_archive_date    ON public.orders_archive(created_at DESC);

-- =====================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE public.config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_archive  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe re-run)
DROP POLICY IF EXISTS "anon_read_config"          ON public.config;
DROP POLICY IF EXISTS "anon_write_config"         ON public.config;
DROP POLICY IF EXISTS "anon_read_shops"           ON public.shops;
DROP POLICY IF EXISTS "anon_insert_shops"         ON public.shops;
DROP POLICY IF EXISTS "anon_update_shops"         ON public.shops;
DROP POLICY IF EXISTS "anon_delete_shops"         ON public.shops;
DROP POLICY IF EXISTS "anon_read_menu"            ON public.menu;
DROP POLICY IF EXISTS "anon_all_menu"             ON public.menu;
DROP POLICY IF EXISTS "anon_read_orders"          ON public.orders;
DROP POLICY IF EXISTS "anon_all_orders"           ON public.orders;
DROP POLICY IF EXISTS "anon_read_expenses"        ON public.expenses;
DROP POLICY IF EXISTS "anon_all_expenses"         ON public.expenses;
DROP POLICY IF EXISTS "anon_read_settings"        ON public.settings;
DROP POLICY IF EXISTS "anon_all_settings"         ON public.settings;
DROP POLICY IF EXISTS "anon_read_archive"         ON public.orders_archive;
DROP POLICY IF EXISTS "anon_all_archive"          ON public.orders_archive;

-- Old policy names (cleanup from previous migration)
DROP POLICY IF EXISTS "Allow public read on shops"     ON public.shops;
DROP POLICY IF EXISTS "Allow public update on shops"   ON public.shops;
DROP POLICY IF EXISTS "Allow public insert on shops"   ON public.shops;
DROP POLICY IF EXISTS "Allow public read on menu"      ON public.menu;
DROP POLICY IF EXISTS "Allow public write on menu"     ON public.menu;
DROP POLICY IF EXISTS "Allow public read on orders"    ON public.orders;
DROP POLICY IF EXISTS "Allow public write on orders"   ON public.orders;
DROP POLICY IF EXISTS "Allow public read on expenses"  ON public.expenses;
DROP POLICY IF EXISTS "Allow public write on expenses" ON public.expenses;

-- Config policies
CREATE POLICY "anon_read_config"   ON public.config   FOR SELECT USING (true);
CREATE POLICY "anon_write_config"  ON public.config   FOR ALL    USING (true);

-- Shops policies
CREATE POLICY "anon_read_shops"    ON public.shops FOR SELECT USING (true);
CREATE POLICY "anon_insert_shops"  ON public.shops FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_shops"  ON public.shops FOR UPDATE USING (true);
CREATE POLICY "anon_delete_shops"  ON public.shops FOR DELETE USING (true);

-- Menu policies
CREATE POLICY "anon_read_menu"     ON public.menu FOR SELECT USING (true);
CREATE POLICY "anon_all_menu"      ON public.menu FOR ALL    USING (true);

-- Orders policies
CREATE POLICY "anon_read_orders"   ON public.orders FOR SELECT USING (true);
CREATE POLICY "anon_all_orders"    ON public.orders FOR ALL    USING (true);

-- Expenses policies
CREATE POLICY "anon_read_expenses" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "anon_all_expenses"  ON public.expenses FOR ALL    USING (true);

-- Settings policies
CREATE POLICY "anon_read_settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "anon_all_settings"  ON public.settings FOR ALL    USING (true);

-- Archive policies
CREATE POLICY "anon_read_archive"  ON public.orders_archive FOR SELECT USING (true);
CREATE POLICY "anon_all_archive"   ON public.orders_archive FOR ALL    USING (true);

-- =====================================================================
-- SECTION 5: REALTIME SUBSCRIPTIONS (instant kitchen alerts)
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu;
  END IF;
END $$;

-- =====================================================================
-- SECTION 6: SERVER-SIDE RPC FUNCTIONS
-- =====================================================================

-- 6a. verify_owner_pin
CREATE OR REPLACE FUNCTION public.verify_owner_pin(
    p_shop_id TEXT,
    p_pin     TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    shop_row public.shops%ROWTYPE;
BEGIN
    SELECT * INTO shop_row
    FROM public.shops
    WHERE id = LOWER(TRIM(p_shop_id));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Restaurant not found.');
    END IF;

    IF shop_row.status != 'Active' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Restaurant is currently suspended.');
    END IF;

    IF shop_row.owner_pin != TRIM(p_pin) THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid Owner PIN.');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'shop', jsonb_build_object(
            'id',        shop_row.id,
            'name',      shop_row.name,
            'logo_url',  shop_row.logo_url,
            'currency',  shop_row.currency,
            'status',    shop_row.status
        )
    );
END;
$$;

-- 6b. place_order — server-side price verification
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
BEGIN
    v_shop_id      := LOWER(TRIM(p_payload->>'shop_id'));
    v_table_number := COALESCE(TRIM(p_payload->>'table_number'), '1');
    v_notes        := COALESCE(TRIM(p_payload->>'customer_notes'), '');
    v_source       := COALESCE(TRIM(p_payload->>'order_source'), 'QR');

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

    INSERT INTO public.orders (id, shop_id, table_number, items, items_summary, total_price, status, customer_notes, order_source)
    VALUES (v_order_id, v_shop_id, v_table_number, v_verified, v_summary, v_grand_total, 'New', v_notes, v_source);

    RETURN jsonb_build_object(
        'success',            true,
        'order_id',           v_order_id,
        'table_number',       v_table_number,
        'total_price',        v_grand_total,
        'currency',           v_currency,
        'verified_by_server', true,
        'message',            'Order placed successfully! Verified by server.'
    );
END;
$$;

-- 6c. change_owner_pin
CREATE OR REPLACE FUNCTION public.change_owner_pin(
    p_shop_id     TEXT,
    p_current_pin TEXT,
    p_new_pin     TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_shop public.shops%ROWTYPE;
BEGIN
    SELECT * INTO v_shop FROM public.shops WHERE id = LOWER(TRIM(p_shop_id));
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Restaurant not found.');
    END IF;

    IF v_shop.owner_pin != TRIM(p_current_pin) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Current PIN is incorrect.');
    END IF;

    IF LENGTH(TRIM(p_new_pin)) < 4 OR LENGTH(TRIM(p_new_pin)) > 16 THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN must be 4-16 characters.');
    END IF;

    UPDATE public.shops SET owner_pin = TRIM(p_new_pin) WHERE id = v_shop.id;

    RETURN jsonb_build_object('success', true, 'message', 'Owner PIN updated successfully.');
END;
$$;

-- 6d. archive_old_orders
CREATE OR REPLACE FUNCTION public.archive_old_orders(
    p_shop_id  TEXT,
    p_days_old INT DEFAULT 30
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_cutoff   TIMESTAMPTZ;
    v_count    INT;
BEGIN
    v_cutoff := NOW() - (p_days_old || ' days')::interval;

    WITH moved AS (
        DELETE FROM public.orders
        WHERE shop_id = LOWER(TRIM(p_shop_id))
          AND created_at < v_cutoff
        RETURNING *
    )
    INSERT INTO public.orders_archive
        (id, shop_id, table_number, items, items_summary, total_price, status, customer_notes, order_source, created_at)
    SELECT id, shop_id, table_number, items, items_summary, total_price, status, customer_notes, order_source, created_at
    FROM moved;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success',       true,
        'archivedCount', v_count,
        'message',       'Moved ' || v_count || ' orders older than ' || p_days_old || ' days to archive.'
    );
END;
$$;

-- =====================================================================
-- SECTION 7: SEED DATA
-- =====================================================================

INSERT INTO public.config (key, value)
VALUES ('master_admin_pin', '998877')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.shops (id, name, logo_url, owner_pin, status, currency)
VALUES ('bismillah', 'Bismillah Biryani & Grill', 'AU-dark-icon.svg', '1234', 'Active', '₹')
ON CONFLICT (id) DO UPDATE SET
    name      = EXCLUDED.name,
    logo_url  = EXCLUDED.logo_url,
    status    = EXCLUDED.status;

INSERT INTO public.menu (id, shop_id, name, category, description, price, is_veg, in_stock) VALUES
    ('dish_1',  'bismillah', 'Special Chicken Dum Biryani', 'Mains',     'Slow-cooked aromatic basmati rice layered with spiced tender chicken and saffron herbs.', 250, false, true),
    ('dish_2',  'bismillah', 'Mutton Rogan Josh',          'Mains',     'Kashmiri delicacy cooked with aromatic spices, dry ginger, and rich Kashmiri chili gravy.',  320, false, true),
    ('dish_3',  'bismillah', 'Butter Chicken Masala',       'Mains',     'Charcoal-grilled chicken simmered in rich creamy tomato and butter gravy.',                 280, false, true),
    ('dish_4',  'bismillah', 'Paneer Tikka Masala',         'Mains',     'Chargrilled cottage cheese cubes cooked in rich tandoori spiced masala gravy.',              220, true,  true),
    ('dish_5',  'bismillah', 'Garlic Butter Naan',          'Breads',    'Clay oven flatbread brushed generously with fresh garlic butter.',                           40,  true,  true),
    ('dish_6',  'bismillah', 'Tandoori Roti',               'Breads',    'Whole wheat crispy unleavened flatbread freshly baked in tandoor.',                           25,  true,  true),
    ('dish_7',  'bismillah', 'Hyderabadi Chicken 65',       'Starters',  'Crispy deep-fried spicy chicken tossed with curry leaves, yogurt, and green chillies.',      190, false, true),
    ('dish_8',  'bismillah', 'Paneer Malai Tikka',          'Starters',  'Soft cottage cheese marinated in cream, cardamom, and cashew paste.',                        180, true,  true),
    ('dish_9',  'bismillah', 'Fresh Sweet Lime Soda',       'Beverages', 'Refreshing fizzy lime soda with mint and rock salt.',                                        60,  true,  true),
    ('dish_10', 'bismillah', 'Royal Shahi Tukda',           'Desserts',  'Crispy ghee-fried bread soaked in cardamom saffron milk and crushed pistachios.',              90,  true,  true)
ON CONFLICT (id) DO UPDATE SET
    name     = EXCLUDED.name,
    category = EXCLUDED.category,
    price    = EXCLUDED.price,
    is_veg   = EXCLUDED.is_veg,
    in_stock = EXCLUDED.in_stock;

INSERT INTO public.settings (shop_id, key, value) VALUES
    ('bismillah', 'restaurant_name', 'Bismillah Biryani & Grill'),
    ('bismillah', 'store_address',   ''),
    ('bismillah', 'phone_number',    ''),
    ('bismillah', 'gstin',           ''),
    ('bismillah', 'waiter_tag',      'Counter POS 01'),
    ('bismillah', 'footer_message',  'Thank you for dining with us! Please visit again.'),
    ('bismillah', 'upi_id',          '')
ON CONFLICT (shop_id, key) DO NOTHING;
