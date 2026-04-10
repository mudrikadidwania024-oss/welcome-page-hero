import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone || !/^\+91\d{10}$/.test(phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Store OTP in Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete old OTPs for this phone
    await supabase.from("otp_codes").delete().eq("phone", phone);

    // Insert new OTP
    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone,
      otp_code: otp,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to generate OTP" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send OTP via SMS Mobile API
    const apiKey = Deno.env.get("SMS_MOBILE_API_KEY")!;
    const smsResponse = await fetch(
      `https://api.smsmobileapi.com/sendsms?apikey=${apiKey}&recipients=${encodeURIComponent(phone)}&message=${encodeURIComponent(`Your VaaniPay OTP is ${otp}. Valid for 5 minutes.`)}`
    );

    const smsResult = await smsResponse.text();
    console.log("SMS API response:", smsResult);

    // Check if SMS was sent successfully
    let smsSent = true;
    try {
      const smsJson = JSON.parse(smsResult);
      if (smsJson?.result?.sent === "api_error" || smsJson?.result?.error) {
        console.warn("SMS send failed, returning OTP in response for testing:", smsResult);
        smsSent = false;
      }
    } catch (_) {
      // If response isn't JSON, continue
    }

    // If SMS failed, return OTP in response for testing purposes
    // TODO: Remove otp from response once SMS service is properly configured
    return new Response(JSON.stringify({ 
      success: true, 
      message: smsSent ? "OTP sent successfully" : "SMS delivery failed. Use the OTP shown below.",
      ...(smsSent ? {} : { otp })
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
