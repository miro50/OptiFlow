// supabase/functions/email-ingest/index.ts
// Supabase Edge Function to receive SendGrid Inbound Parse email webhooks,
// parse CSV attachments, and update SKU stock quantities automatically.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// RFC 4180-compliant CSV parser with automatic delimiter detection (comma vs semicolon)
// to support Italian Excel/ERP output.
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let currentVal = '';
  let inQuotes = false;
  
  // Detect separator: count commas vs semicolons in the first 500 chars
  const sample = text.substring(0, 500);
  const commas = (sample.match(/,/g) || []).length;
  const semicolons = (sample.match(/;/g) || []).length;
  const delimiter = semicolons > commas ? ';' : ',';

  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
    } else if (char === delimiter && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = '';
      i++;
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      row.push(currentVal.trim());
      if (row.length > 0 && row.some(cell => cell !== '')) {
        lines.push(row);
      }
      row = [];
      currentVal = '';
      i++;
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentVal += char;
      i++;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    if (row.some(cell => cell !== '')) {
      lines.push(row);
    }
  }
  return lines;
}

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const formData = await req.formData();
    
    const fromRaw = formData.get("from")?.toString() || "";
    const toRaw = formData.get("to")?.toString() || "";
    
    // Extract actual email addresses
    const fromEmailMatch = fromRaw.match(/<?([^<\s]+@[^>\s]+)>?/);
    const toEmailMatch = toRaw.match(/<?([^<\s]+@[^>\s]+)>?/);
    
    const fromEmail = fromEmailMatch ? fromEmailMatch[1] : fromRaw;
    const toEmail = toEmailMatch ? toEmailMatch[1] : toRaw;
    
    console.log(`Received email webhook. From: ${fromEmail}, To: ${toEmail}`);

    // Parse mailbox token (e.g. ingest-TOKEN@incoming.previso.it)
    const tokenMatch = toEmail.match(/ingest-([^@]+)@/);
    if (!tokenMatch) {
      return new Response(JSON.stringify({ error: 'Invalid recipient mailbox format' }), {
        status: 200, // Return 200 to SendGrid so it doesn't retry invalid webhooks indefinitely
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const mailboxToken = tokenMatch[1];

    // Find CSV attachment
    let csvFile: File | null = null;
    let csvFieldName = '';
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.name.toLowerCase().endsWith('.csv')) {
        csvFile = value;
        csvFieldName = key;
        break;
      }
    }

    if (!csvFile) {
      console.warn("No CSV attachment found in email");
      return new Response(JSON.stringify({ error: 'No CSV file attached' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch tenant settings matching the mailbox token
    const { data: settings, error: settingsError } = await supabase
      .from('tenant_settings')
      .select('tenant_id, erp_sender_email, csv_column_mapping')
      .eq('ingest_mailbox_token', mailboxToken)
      .single();

    if (settingsError || !settings) {
      console.warn(`Tenant settings not found for mailbox token: ${mailboxToken}`);
      return new Response(JSON.stringify({ error: 'Tenant settings not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify sender whitelist
    const whitelistedSenders = settings.erp_sender_email
      ? settings.erp_sender_email.split(/[\s,;]+/).map((e: string) => e.toLowerCase().trim())
      : [];
    
    if (whitelistedSenders.length > 0 && !whitelistedSenders.includes(fromEmail.toLowerCase().trim())) {
      console.warn(`Unauthorized sender: ${fromEmail} tried to upload to tenant: ${settings.tenant_id}`);
      return new Response(JSON.stringify({ error: 'Sender not whitelisted' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read and parse CSV content
    const csvText = await csvFile.text();
    const parsedRows = parseCSV(csvText);
    
    if (parsedRows.length < 2) {
      console.warn("Empty or invalid CSV uploaded");
      return new Response(JSON.stringify({ error: 'CSV file contains no data rows' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mapping = settings.csv_column_mapping as {
      skuCodeCol: string;
      stockCol: string;
    };

    const headers = parsedRows[0];
    const skuCodeIdx = headers.indexOf(mapping.skuCodeCol);
    const stockIdx = headers.indexOf(mapping.stockCol);

    if (skuCodeIdx === -1 || stockIdx === -1) {
      const msg = `CSV headers do not match configured mappings. Expected headers: ${mapping.skuCodeCol}, ${mapping.stockCol}. Found: ${headers.join(', ')}`;
      console.warn(msg);
      return new Response(JSON.stringify({ error: 'CSV headers do not match mapping' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the array of SKU updates
    const updates = [];
    for (let r = 1; r < parsedRows.length; r++) {
      const row = parsedRows[r];
      const skuCode = row[skuCodeIdx];
      const stockStr = row[stockIdx];
      
      if (skuCode && stockStr) {
        // Handle Italian decimals (e.g. 150,50 -> 150.50)
        const parsedStock = parseFloat(stockStr.replace(',', '.').replace(/\s/g, ''));
        if (!isNaN(parsedStock)) {
          updates.push({
            tenant_id: settings.tenant_id,
            code: skuCode,
            stock: parsedStock
          });
        }
      }
    }

    console.log(`Parsed ${updates.length} valid SKU updates from CSV. Invoking database RPC...`);

    // Call high performance batch update RPC
    const { error: rpcError } = await supabase.rpc('update_sku_stocks', { updates });

    if (rpcError) {
      console.error("Database RPC error:", rpcError);
      return new Response(JSON.stringify({ error: 'Database update failed', details: rpcError }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("Database SKU stock quantities updated successfully");
    return new Response(JSON.stringify({ success: true, updatedSKUsCount: updates.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error("Critical error in email-ingest function:", err);
    return new Response(JSON.stringify({ error: 'Internal server error', message: err.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
