-- 20260714000004_owner_phone.sql
-- Add contact phone column for WhatsApp alerts to tenant_settings.

ALTER TABLE tenant_settings 
    ADD COLUMN owner_phone TEXT;
