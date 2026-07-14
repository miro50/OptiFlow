-- 20260714000005_po_delivery_date.sql
-- Add expected delivery date and confirmation metadata columns to purchase_orders table.

ALTER TABLE purchase_orders 
    ADD COLUMN expected_delivery_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN confirmation_parsed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN confirmation_raw_text TEXT;
