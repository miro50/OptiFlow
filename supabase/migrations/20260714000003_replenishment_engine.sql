-- 20260714000003_replenishment_engine.sql
-- Create database helper views and functions to compute replenishment orders,
-- apply consolidation optimization, and generate Draft POs.

-- View to calculate quantities currently on active orders per SKU code
CREATE OR REPLACE VIEW sku_on_order_quantities AS
SELECT 
    s.tenant_id,
    s.code AS sku_code,
    COALESCE(SUM(poi.quantity), 0) AS on_order_qty
FROM skus s
LEFT JOIN purchase_order_items poi ON poi.sku_code = s.code
LEFT JOIN purchase_orders po ON po.id = poi.po_id 
    AND po.tenant_id = s.tenant_id
    AND po.status IN ('draft', 'approved', 'sent')
GROUP BY s.tenant_id, s.code;

-- Main function to run replenishment engine and output Draft POs
CREATE OR REPLACE FUNCTION run_replenishment_engine(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_supplier RECORD;
    v_sku RECORD;
    v_po_id UUID;
    v_po_total NUMERIC(12, 2);
    v_added_total NUMERIC(12, 2);
    v_item_total NUMERIC(12, 2);
    v_qty NUMERIC(12, 2);
    v_po_count INT := 0;
    v_result_list JSONB := '[]'::jsonb;
    v_po_items JSONB;
BEGIN
    -- Delete existing draft POs for this tenant to recalculate fresh recommendations
    DELETE FROM purchase_orders 
    WHERE tenant_id = p_tenant_id AND status = 'draft';

    -- 1. Loop through all suppliers of this tenant
    FOR v_supplier IN 
        SELECT id, name, free_shipping_threshold, min_po_amount 
        FROM suppliers 
        WHERE tenant_id = p_tenant_id
    LOOP
        v_po_items := '[]'::jsonb;
        v_po_total := 0;

        -- 2. Find triggered SKUs for this supplier
        FOR v_sku IN 
            SELECT s.code, s.description, s.unit_cost, s.min_stock, s.max_stock, s.lot_size_moq, s.current_stock,
                   COALESCE(oq.on_order_qty, 0) AS on_order_qty
            FROM skus s
            LEFT JOIN sku_on_order_quantities oq ON oq.tenant_id = s.tenant_id AND oq.sku_code = s.code
            WHERE s.tenant_id = p_tenant_id 
              AND s.supplier_id = v_supplier.id
              AND (s.current_stock + COALESCE(oq.on_order_qty, 0)) <= s.min_stock
        LOOP
            -- Replenishment quantity formula: maxStock - available, rounded up to lotSizeMOQ
            v_qty := GREATEST(v_sku.lot_size_moq, CEIL((v_sku.max_stock - (v_sku.current_stock + v_sku.on_order_qty)) / v_sku.lot_size_moq) * v_sku.lot_size_moq);
            v_item_total := v_qty * v_sku.unit_cost;
            v_po_total := v_po_total + v_item_total;

            v_po_items := v_po_items || jsonb_build_object(
                'sku_code', v_sku.code,
                'quantity', v_qty,
                'unit_cost', v_sku.unit_cost
            );
        END LOOP;

        -- 3. If there are triggered items, apply Consolidated Order Optimizer
        IF jsonb_array_length(v_po_items) > 0 THEN
            -- Check if PO total is below the free shipping threshold
            IF v_supplier.free_shipping_threshold > 0 AND v_po_total < v_supplier.free_shipping_threshold THEN
                -- Find non-triggered SKUs for this supplier, sorted by safety level ratio (closest to trigger first)
                FOR v_sku IN 
                    SELECT s.code, s.description, s.unit_cost, s.min_stock, s.max_stock, s.lot_size_moq, s.current_stock,
                           COALESCE(oq.on_order_qty, 0) AS on_order_qty,
                           -- Ratio: current stock + on order over min_stock. Closer to 1.0 means closer to trigger.
                           (s.current_stock + COALESCE(oq.on_order_qty, 0)) / NULLIF(s.min_stock, 0) AS safety_ratio
                    FROM skus s
                    LEFT JOIN sku_on_order_quantities oq ON oq.tenant_id = s.tenant_id AND oq.sku_code = s.code
                    WHERE s.tenant_id = p_tenant_id 
                      AND s.supplier_id = v_supplier.id
                      AND (s.current_stock + COALESCE(oq.on_order_qty, 0)) > s.min_stock
                    ORDER BY safety_ratio ASC
                LOOP
                    -- Exit loop if we have reached the free shipping threshold
                    EXIT WHEN v_po_total >= v_supplier.free_shipping_threshold;

                    -- Add 1 lot size MOQ of the filler item
                    v_qty := v_sku.lot_size_moq;
                    v_item_total := v_qty * v_sku.unit_cost;
                    v_po_total := v_po_total + v_item_total;

                    v_po_items := v_po_items || jsonb_build_object(
                        'sku_code', v_sku.code,
                        'quantity', v_qty,
                        'unit_cost', v_sku.unit_cost,
                        'is_filler', true
                    );
                END LOOP;
            END IF;

            -- 4. Create the Draft Purchase Order
            INSERT INTO purchase_orders (tenant_id, supplier_id, status, total_amount)
            VALUES (p_tenant_id, v_supplier.id, 'draft', v_po_total)
            RETURNING id INTO v_po_id;

            -- Insert the items
            INSERT INTO purchase_order_items (po_id, sku_code, quantity, unit_cost)
            SELECT v_po_id, (item->>'sku_code'), (item->>'quantity')::NUMERIC, (item->>'unit_cost')::NUMERIC
            FROM jsonb_array_elements(v_po_items) AS item;

            v_po_count := v_po_count + 1;
            v_result_list := v_result_list || jsonb_build_object(
                'po_id', v_po_id,
                'supplier_name', v_supplier.name,
                'total_amount', v_po_total,
                'items_count', jsonb_array_length(v_po_items)
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'draft_pos_count', v_po_count,
        'pos', v_result_list
    );
END;
$$ LANGUAGE plpgsql;
