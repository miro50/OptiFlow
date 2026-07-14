-- 20260714000001_inbound_ingestion.sql
-- Add fields to support CSV ingestion whitelisting, ingestion mailboxes, and supplier thresholds.

ALTER TABLE tenant_settings 
    ADD COLUMN erp_sender_email TEXT,
    ADD COLUMN ingest_mailbox_token TEXT UNIQUE;

ALTER TABLE suppliers
    ADD COLUMN free_shipping_threshold NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    ADD COLUMN min_po_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL;
