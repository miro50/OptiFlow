// supabase/functions/email-confirm/index.ts
// Supabase Edge Function to receive incoming supplier confirmation emails/PDFs via SendGrid Inbound Parse,
// parse the PO reference token, extract delivery dates using layout-aware heuristics, and update POs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Italian months dictionary for string-based date parsing
const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
  luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
  gen: 0, feb: 1, mar: 2, apr: 3, mag: 4, giu: 5, lug: 6, ago: 7, set: 8, ott: 9, nov: 10, dic: 11
};

// Heuristic extractor for delivery dates inside raw text (email body or parsed PDF)
function extractDeliveryDate(text: string): Date | null {
  const cleanText = text.replace(/\s+/g, ' ');
  const candidates: { date: Date; score: number }[] = [];
  
  // Pattern 1: Numerical dates (e.g. 28/07/2026, 28-07-2026, 28.07.2026)
  const numericRegex = /\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/g;
  const numericMatches = [...cleanText.matchAll(numericRegex)];
  
  for (const match of numericMatches) {
    let day = parseInt(match[1]);
    let month = parseInt(match[2]);
    let year = parseInt(match[3]);
    if (year < 100) {
      year += 2000;
    }
    
    const d = new Date(year, month - 1, day);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (isNaN(d.getTime()) || d < yesterday) continue;
    
    let score = 1;
    const matchIndex = match.index || 0;
    const context = cleanText.substring(Math.max(0, matchIndex - 60), Math.min(cleanText.length, matchIndex + 60)).toLowerCase();
    
    if (context.includes('consegna') || context.includes('consegneremo') || context.includes('consegna prevista') || context.includes('data')) {
      score += 5;
    }
    if (context.includes('spedizione') || context.includes('spediremo')) {
      score += 3;
    }
    
    candidates.push({ date: d, score });
  }

  // Pattern 2: Literal dates (e.g. 28 Luglio 2026, 28-Gen-26)
  const monthNamesPattern = Object.keys(ITALIAN_MONTHS).join('|');
  const literalRegex = new RegExp(`\\b(\\d{1,2})[\\s\\.-](${monthNamesPattern})[\\s\\.-](\\d{2,4})\\b`, 'gi');
  const literalMatches = [...cleanText.matchAll(literalRegex)];

  for (const match of literalMatches) {
    let day = parseInt(match[1]);
    let monthName = match[2].toLowerCase();
    let year = parseInt(match[3]);
    if (year < 100) {
      year += 2000;
    }
    
    const month = ITALIAN_MONTHS[monthName];
    const d = new Date(year, month, day);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (isNaN(d.getTime()) || d < yesterday) continue;

    let score = 2; // Literal dates are less likely to be noise
    const matchIndex = match.index || 0;
    const context = cleanText.substring(Math.max(0, matchIndex - 60), Math.min(cleanText.length, matchIndex + 60)).toLowerCase();
    
    if (context.includes('consegna') || context.includes('consegneremo') || context.includes('consegna prevista') || context.includes('data')) {
      score += 5;
    }
    if (context.includes('spedizione') || context.includes('spediremo')) {
      score += 3;
    }

    candidates.push({ date: d, score });
  }

  if (candidates.length === 0) return null;
  
  candidates.sort((a, b) => b.score - a.score || a.date.getTime() - b.date.getTime());
  return candidates[0].date;
}

async function findPOByToken(supabase: any, poToken: string) {
  const { data: pos, error } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .in('status', ['approved', 'sent']);

  if (error || !pos) {
    console.error("Error fetching active POs for token matching:", error);
    return null;
  }

  const matched = pos.find((p: any) => p.id.toLowerCase().startsWith(poToken.toLowerCase()));
  return matched || null;
}

serve(async (req) => {
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
    const formData = await req.formData();
    const fromRaw = formData.get('from')?.toString() || '';
    const subject = formData.get('subject')?.toString() || '';
    const emailBody = formData.get('text')?.toString() || formData.get('html')?.toString() || '';

    console.log(`Received incoming email reply. Subject: "${subject}", From: ${fromRaw}`);

    // 1. Extract PO ID token (first 8 hex characters of the UUID, e.g. PO-f3b69fe1)
    const tokenRegex = /PO-([a-fA-F0-9]{8})/i;
    const tokenMatch = subject.match(tokenRegex) || emailBody.match(tokenRegex);
    
    if (!tokenMatch) {
      console.warn("Could not find any PO token reference in email subject or body");
      return new Response(JSON.stringify({ error: 'No PO reference token found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const poToken = tokenMatch[1].toLowerCase();
    console.log(`Found PO token reference: PO-${poToken}`);

    // 2. Parse attachments to find confirmation PDF
    let pdfFile: File | null = null;
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.name.toLowerCase().endsWith('.pdf')) {
        pdfFile = value;
        break;
      }
    }

    let rawTextToParse = emailBody;
    let pdfText = '';

    if (pdfFile) {
      console.log(`PDF confirmation attachment detected: "${pdfFile.name}". Parsing text...`);
      try {
        // Dynamic import of pdfjs-dist only on demand to prevent boot failures for text-only webhooks
        const pdfjs = await import("https://esm.sh/pdfjs-dist@3.4.120/build/pdf?alias=canvas:https://esm.sh/noop2");
        pdfjs.GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@3.4.120/build/pdf.worker.js?alias=canvas:https://esm.sh/noop2";
        
        const buffer = new Uint8Array(await pdfFile.arrayBuffer());
        const loadingTask = pdfjs.getDocument({
          data: buffer,
          useSystemFonts: true,
          disableFontFace: true,
          verbosity: 0
        });
        const doc = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
          fullText += pageText + '\n';
        }
        pdfText = fullText;
        rawTextToParse = pdfText + "\n" + emailBody;
        console.log(`Successfully parsed PDF. Extracted ${pdfText.length} characters.`);
      } catch (pdfErr) {
        console.error("Error parsing PDF attachment:", pdfErr);
      }
    }

    // 3. Extract delivery date using heuristics
    const extractedDate = extractDeliveryDate(rawTextToParse);
    
    if (!extractedDate) {
      console.warn("Could not confidently extract expected delivery date from raw text");
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const matchedPO = await findPOByToken(supabase, poToken);
      if (matchedPO) {
        await supabase
          .from('purchase_orders')
          .update({
            confirmation_raw_text: rawTextToParse.substring(0, 5000),
            confirmation_parsed_at: new Date().toISOString()
          })
          .eq('id', matchedPO.id);
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Date extraction failed', 
        po_token: poToken,
        details: 'Sent to manual review queue' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Extracted delivery date: ${extractedDate.toISOString()}`);

    // 4. Update the Purchase Order in the Database
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const matchedPO = await findPOByToken(supabase, poToken);
    if (!matchedPO) {
      console.warn(`Purchase order not found matching token: ${poToken}`);
      return new Response(JSON.stringify({ error: 'Purchase order not found matching token' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log("Matched Purchase Order:", matchedPO.id);

    // Update PO details
    const { error: poUpdateErr } = await supabase
      .from('purchase_orders')
      .update({
        expected_delivery_at: extractedDate.toISOString(),
        confirmation_parsed_at: new Date().toISOString(),
        confirmation_raw_text: rawTextToParse.substring(0, 5000)
      })
      .eq('id', matchedPO.id);

    if (poUpdateErr) {
      console.error("Database update error:", poUpdateErr);
      return new Response(JSON.stringify({ error: 'Database update failed', details: poUpdateErr }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Purchase order PO-${poToken} updated with delivery date: ${extractedDate.toDateString()}`);
    return new Response(JSON.stringify({ 
      success: true, 
      po_id: matchedPO.id, 
      po_token: poToken,
      extracted_delivery_date: extractedDate.toISOString() 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error("Critical error in email-confirm function:", err);
    return new Response(JSON.stringify({ error: 'Internal server error', message: err.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
