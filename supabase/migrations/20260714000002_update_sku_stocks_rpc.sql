-- 20260714000002_update_sku_stocks_rpc.sql
-- Create an RPC to update SKU stocks in batch for high performance.

CREATE OR REPLACE FUNCTION update_sku_stocks(updates JSONB)
RETURNS VOID AS $$
DECLARE
    item RECORD;
BEGIN
    FOR item IN SELECT * FROM jsonb_to_recordset(updates) AS x(tenant_id UUID, code TEXT, stock NUMERIC)
    LOOP
        UPDATE skus 
        SET current_stock = item.stock 
        WHERE tenant_id = item.tenant_id AND code = item.code;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
