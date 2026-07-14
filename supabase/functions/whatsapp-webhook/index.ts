// supabase/functions/whatsapp-webhook/index.ts
// Supabase Edge Function to receive Twilio WhatsApp message webhooks,
// verify sender identity against tenant whitelists, and execute reorder approvals.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple XML TwiML builder to reply to Twilio webhooks
function twimlResponse(messageText: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${messageText}</Message>
</Response>`;
  
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Twilio webhook payloads are urlencoded form data
    const formData = await req.formData();
    const fromRaw = formData.get('From')?.toString() || ''; // e.g. "whatsapp:+39333123456"
    const body = formData.get('Body')?.toString() || '';
    
    const cleanPhone = fromRaw.replace('whatsapp:', '').trim();
    const digitsOnlyIncoming = cleanPhone.replace(/\D/g, '');

    console.log(`Received WhatsApp incoming message from: ${cleanPhone}, Body: "${body}"`);

    if (!digitsOnlyIncoming) {
      return twimlResponse("Previso Autopilot: Impossibile identificare il numero mittente.");
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Retrieve all settings to verify phone whitelist (resilient match)
    const { data: allSettings, error: settingsErr } = await supabase
      .from('tenant_settings')
      .select('tenant_id, owner_phone');

    if (settingsErr || !allSettings) {
      console.error("Database settings retrieve error:", settingsErr);
      return twimlResponse("Previso Autopilot: Errore del database durante la verifica dell'autorizzazione.");
    }

    const match = allSettings.find(s => {
      if (!s.owner_phone) return false;
      const cleanOwner = s.owner_phone.replace(/\D/g, '');
      return digitsOnlyIncoming.endsWith(cleanOwner) || cleanOwner.endsWith(digitsOnlyIncoming);
    });

    if (!match) {
      console.warn(`Unauthorized phone number tried to access autopilot: ${cleanPhone}`);
      return twimlResponse("Previso Autopilot: Questo numero di telefono non è associato a nessuna azienda registrata.");
    }

    const tenantId = match.tenant_id;
    const isApprovalTrigger = /^(si|approva|yes|ok)$/i.test(body.trim());

    if (!isApprovalTrigger) {
      return twimlResponse("Previso Autopilot: Rispondi 'SI' o 'APPROVA' per autorizzare l'invio delle bozze degli ordini d'acquisto correnti.");
    }

    // Fetch details of draft purchase orders to verify they exist
    const { data: draftPOs } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'draft');

    if (!draftPOs || draftPOs.length === 0) {
      return twimlResponse("Previso Autopilot: Non ci sono bozze d'ordine d'acquisto in attesa di approvazione per la tua azienda.");
    }

    // Approve the orders
    const { data: updatedPOs, error: updateErr } = await supabase
      .from('purchase_orders')
      .update({ status: 'approved' })
      .eq('tenant_id', tenantId)
      .eq('status', 'draft')
      .select('id');

    if (updateErr) {
      console.error("Error approving POs via WhatsApp:", updateErr);
      return twimlResponse("Previso Autopilot: Errore di sistema durante l'approvazione degli ordini d'acquisto. Riprova più tardi.");
    }

    const count = updatedPOs?.length || 0;
    console.log(`Approved ${count} POs via WhatsApp for tenant: ${tenantId}`);

    return twimlResponse(`Previso Autopilot: Ordini approvati! ${count} ordini d'acquisto sono stati autorizzati e verranno spediti via email ai rispettivi fornitori.`);

  } catch (err: any) {
    console.error("Critical error in whatsapp-webhook:", err);
    return twimlResponse(`Previso Autopilot: Errore interno del server.`);
  }
});
