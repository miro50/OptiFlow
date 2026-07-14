# Inbound Email CSV Ingestion Setup Guide (SendGrid)

This guide documents the steps required to configure the production DNS and SendGrid settings to route ERP CSV stock exports to the `email-ingest` Supabase Edge Function.

## 1. Domain and MX Record Configuration
To receive emails at `@incoming.previso.it`, you must configure a DNS MX record pointing to SendGrid's email inbound receiving servers.

1.  Log into your domain registrar (e.g., Aruba, GoDaddy, Cloudflare).
2.  Add a new **MX (Mail Exchanger)** record:
    *   **Host/Subdomain**: `incoming` (resulting in `incoming.previso.it`)
    *   **Value/Destination**: `mx.sendgrid.net.`
    *   **Priority**: `10`
3.  Add a **TXT** SPF verification record for authentication and to prevent spam filters from rejecting inbound routing:
    *   **Host/Subdomain**: `incoming`
    *   **Value**: `v=spf1 include:sendgrid.net ~all`

---

## 2. SendGrid Inbound Parse Configuration
SendGrid will receive the email, convert it into a structured HTTP POST multipart/form-data payload, and call Previso's webhook.

1.  Log in to your SendGrid dashboard.
2.  Navigate to **Settings** > **Inbound Parse**.
3.  Click **Add Host & URL**.
4.  Fill in the parameters:
    *   **Subdomain**: `incoming`
    *   **Domain**: `previso.it`
    *   **Destination URL**: `https://vlcffxunkcpxyoetrpxm.supabase.co/functions/v1/email-ingest`
    *   **Spam Check**: Checked (Optional, drops spam emails before they hit Supabase, reducing function execution costs).
5.  Click **Save**.

---

## 3. Database Activation for Tenants
To authorize a tenant, configure their database settings with an approved ERP sender email address and generate their unique ingest mailbox token.

```sql
UPDATE tenant_settings 
SET 
  erp_sender_email = 'magazzino@azienda-rossi.it', 
  ingest_mailbox_token = 'rossi-7a9b8c2d' 
WHERE tenant_id = '[TENANT_ID]';
```

The ERP must now be programmed to send a daily automated email:
*   **To**: `ingest-rossi-7a9b8c2d@incoming.previso.it`
*   **From**: `magazzino@azienda-rossi.it`
*   **Attachment**: A CSV export with stock level columns matching the tenant's column mapping.
