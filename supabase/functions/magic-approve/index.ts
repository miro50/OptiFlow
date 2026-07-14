// supabase/functions/magic-approve/index.ts
// Supabase Edge Function rendering a secure, mobile-friendly magic approval portal
// and executing purchase order approval actions using JWT validation.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate cryptography key from JWT Secret
async function getCryptoKey() {
  const secret = Deno.env.get('JWT_SECRET') || 'fallback-secret-key-1234567890';
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Beautiful layout template with premium modern styling (dark mode, glassmorphism)
function renderHtml(content: string, script = "") {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Previso Autopilot — Approvazione Ordini</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --card: rgba(17, 19, 32, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --primary: #10b981;
      --primary-hover: #059669;
      --primary-glow: rgba(16, 185, 129, 0.15);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.05) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.05) 0%, transparent 40%);
    }
    h1, h2, h3 { font-family: 'Outfit', sans-serif; font-weight: 800; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 2.5rem;
      width: 100%;
      max-width: 520px;
      backdrop-filter: blur(20px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    .logo-container {
      margin-bottom: 2rem;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
    }
    .logo-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #10b981, #3b82f6);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      color: white;
      font-size: 1.2rem;
      box-shadow: 0 0 15px var(--primary-glow);
    }
    .logo-text {
      font-size: 1.5rem;
      background: linear-gradient(to right, #10b981, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .title {
      font-size: 1.8rem;
      margin-bottom: 0.75rem;
      letter-spacing: -0.025em;
    }
    .description {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 2rem;
      line-height: 1.5;
    }
    .po-list {
      text-align: left;
      margin-bottom: 2rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 16px;
      padding: 1rem;
      border: 1px solid var(--border);
    }
    .po-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .po-item:last-child { border-bottom: none; }
    .po-supplier { font-weight: 600; font-size: 0.95rem; }
    .po-meta { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem; }
    .po-amount { font-family: 'Outfit', sans-serif; font-weight: 600; color: #10b981; }
    .btn {
      width: 100%;
      background: linear-gradient(135deg, #10b981, #059669);
      border: none;
      color: white;
      padding: 1rem;
      border-radius: 14px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 10px 20px var(--primary-glow);
      transition: all 0.2s ease;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(16, 185, 129, 0.3);
    }
    .btn:active { transform: translateY(0); }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .success-icon {
      width: 64px;
      height: 64px;
      background: var(--primary-glow);
      color: var(--primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      margin: 0 auto 1.5rem;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <div class="logo-icon">P</div>
      <div class="logo-text">Previso</div>
    </div>
    ${content}
  </div>
  ${script}
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(renderHtml(`
      <div class="success-icon" style="color: #ef4444; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2);">✕</div>
      <h2 class="title">Accesso Negato</h2>
      <p class="description">Token di autenticazione mancante o non valido. Verifica il link ricevuto.</p>
    `), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  try {
    // 1. Verify Cryptographic JWT token
    const cryptoKey = await getCryptoKey();
    const payload = await verify(token, cryptoKey);
    const tenantId = payload.tenant_id as string;

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch tenant details
    const { data: tenant } = await supabase
      .from('tenants')
      .select('company_name')
      .eq('id', tenantId)
      .single();

    // Handle POST request (approving POs)
    if (req.method === 'POST') {
      // Update all draft POs to 'approved' for this tenant
      const { data: updatedPOs, error: updateErr } = await supabase
        .from('purchase_orders')
        .update({ status: 'approved' })
        .eq('tenant_id', tenantId)
        .eq('status', 'draft')
        .select('id');

      if (updateErr) {
        console.error("Error approving POs:", updateErr);
        return new Response(renderHtml(`
          <div class="success-icon" style="color: #ef4444; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2);">✕</div>
          <h2 class="title">Errore di Approvazione</h2>
          <p class="description">Impossibile approvare gli ordini a livello di database. Riprova più tardi.</p>
        `), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      const count = updatedPOs?.length || 0;
      return new Response(renderHtml(`
        <div class="success-icon">✓</div>
        <h2 class="title">Ordini Approvati!</h2>
        <p class="description">Previso ha approvato con successo ${count} ordini d'acquisto per <strong>${tenant?.company_name || 'la tua azienda'}</strong>. I PDF verranno generati e spediti via email ai fornitori.</p>
      `), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // Handle GET request (render POs list and approve button)
    // Fetch draft purchase orders and supplier details
    const { data: draftPOs, error: poErr } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        total_amount,
        suppliers ( name )
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'draft');

    if (poErr || !draftPOs || draftPOs.length === 0) {
      return new Response(renderHtml(`
        <div class="success-icon" style="color: #3b82f6; background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.2);">ℹ</div>
        <h2 class="title">Nessun Ordine Pendente</h2>
        <p class="description">Non ci sono bozze di ordini d'acquisto in attesa di approvazione per <strong>${tenant?.company_name || 'la tua azienda'}</strong>.</p>
      `), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // Calculate total amount
    const totalOrderCost = draftPOs.reduce((acc, po) => acc + Number(po.total_amount), 0);

    let poItemsHtml = '';
    draftPOs.forEach(po => {
      const supplierName = (po.suppliers as any)?.name || 'Fornitore';
      poItemsHtml += `
        <div class="po-item">
          <div>
            <div class="po-supplier">${supplierName}</div>
            <div class="po-meta">Bozza Ordine d'Acquisto</div>
          </div>
          <div class="po-amount">€${Number(po.total_amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        </div>
      `;
    });

    const pageContent = `
      <h2 class="title" style="margin-bottom: 0.5rem;">Bozze Ordine d'Acquisto</h2>
      <p class="description" style="margin-bottom: 1.5rem;">Previso Autopilot ha generato ${draftPOs.length} ordini per <strong>${tenant?.company_name}</strong>. Clicca per inviarli ai fornitori.</p>
      
      <div class="po-list">
        ${poItemsHtml}
        <div class="po-item" style="border-top: 1px solid var(--border); font-weight: bold; background: rgba(255,255,255,0.02)">
          <div>TOTALE ORDINI</div>
          <div class="po-amount" style="color: #f3f4f6; font-size: 1.1rem;">€${totalOrderCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <button id="approve-btn" class="btn">Approva e Invia ${draftPOs.length} Ordini</button>
    `;

    const script = `
      <script>
        document.getElementById('approve-btn').addEventListener('click', async function() {
          const btn = this;
          btn.disabled = true;
          btn.innerHTML = 'Approvazione in corso...';
          
          try {
            const form = document.createElement('form');
            form.method = 'POST';
            document.body.appendChild(form);
            form.submit();
          } catch(err) {
            alert('Si è verificato un errore durante l\\'invio dell\\'approvazione.');
            btn.disabled = false;
            btn.innerHTML = 'Approva e Invia Ordini';
          }
        });
      </script>
    `;

    return new Response(renderHtml(pageContent, script), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (err: any) {
    console.error("Magic link verification error:", err);
    return new Response(renderHtml(`
      <div class="success-icon" style="color: #ef4444; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2);">✕</div>
      <h2 class="title">Link Scaduto</h2>
      <p class="description">Questo link di approvazione non è più valido o è scaduto (validità massima 2 ore). Richiedi un nuovo link dal gestionale.</p>
    `), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
});
