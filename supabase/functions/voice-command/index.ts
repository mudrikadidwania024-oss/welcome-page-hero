import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { transcript, balance } = await req.json();

    if (!transcript) {
      return new Response(JSON.stringify({ error: "No transcript provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a voice assistant for VaaniPay, a UPI payment app. Parse the user's voice command and return a JSON response.

The user's current balance is ₹${balance || "0"}.

You must respond with ONLY valid JSON in this exact format:
{
  "action": "navigate" | "pay" | "balance" | "unknown",
  "route": "/path" (for navigation),
  "amount": number (for payments),
  "recipient": "name" (for payments),
  "response_text": "friendly response to speak back to the user in the same language they spoke"
}

Supported routes: /scan, /pay-contact, /pay-phone, /bank-transfer, /upi, /self-transfer, /pay-bills, /recharge, /history, /profile, /balance

Examples:
- "Send 500 rupees to Rahul" → {"action":"pay","amount":500,"recipient":"Rahul","response_text":"Sending 500 rupees to Rahul"}
- "What is my balance" → {"action":"balance","response_text":"Your current balance is ₹${balance}"}
- "Open scan QR" → {"action":"navigate","route":"/scan","response_text":"Opening QR scanner"}
- "Pay bills" → {"action":"navigate","route":"/pay-bills","response_text":"Opening bill payments"}
- "Show transaction history" → {"action":"navigate","route":"/history","response_text":"Opening transaction history"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Command processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON from the response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { action: "unknown", response_text: "Sorry, I didn't understand that." };
    } catch {
      parsed = { action: "unknown", response_text: "Sorry, I couldn't process that command." };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-command error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
