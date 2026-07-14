# TODOS

## Infrastructure

### Supabase Database Migrations

**What:** Deploy relational tables on production Supabase instance.
**Why:** Transition from temporary local-first client database state to persistent cloud storage.
**Context:** Need to translate local db.ts schemas (Tenants, Suppliers, SKUs, Orders) into PostgreSQL DDL scripts and deploy via Supabase CLI.
**Effort:** M
**Priority:** P1
**Depends on:** None

### User Authentication Layer

**What:** Implement Supabase Managed Auth in frontend.
**Why:** Secure access and enable multi-tenant workspace routing for different Italian SMEs.
**Context:** Integrate Google/email auth flows using Supabase Auth SDK and bind tenant details dynamically.
**Effort:** M
**Priority:** P1
**Depends on:** Supabase Database Migrations

### Row-Level Security (RLS) Enablement

**What:** Setup tenant_id isolation policies.
**Why:** Guarantee that data from one SME cannot be accessed or modified by another tenant.
**Context:** Write PostgreSQL RLS policies matching current tenant defaults using authentication tokens.
**Effort:** S
**Priority:** P1
**Depends on:** User Authentication Layer

### Supabase Edge Functions & Resend Email Integration

**What:** Set up production mail server edge function.
**Why:** Dispatch real replenishment purchase order PDFs to supplier addresses.
**Context:** Replace the current simulated frontend dispatch overlay with a serverless edge trigger calling Resend API.
**Effort:** S
**Priority:** P1
**Depends on:** Row-Level Security (RLS) Enablement

## Completed
