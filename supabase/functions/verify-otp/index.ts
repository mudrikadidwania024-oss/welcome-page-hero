import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();
    console.log("Verify request for phone:", phone, "otp:", otp);

    if (!phone || !otp) {
      return new Response(JSON.stringify({ error: "Phone and OTP are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // First check all OTPs for this phone for debugging
    const { data: allOtps } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: false });
    
    console.log("All OTPs for phone:", JSON.stringify(allOtps));

    // Find matching OTP - don't filter by expiry in query, check manually
    const { data: otpRecords, error } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phone)
      .eq("otp_code", otp)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1);

    console.log("Matching OTPs:", JSON.stringify(otpRecords), "error:", error);

    const otpRecord = otpRecords?.[0];

    if (error || !otpRecord) {
      return new Response(JSON.stringify({ error: "Invalid or expired OTP" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry manually
    const expiresAt = new Date(otpRecord.expires_at);
    const now = new Date();
    console.log("Expires at:", expiresAt.toISOString(), "Now:", now.toISOString());

    if (expiresAt < now) {
      return new Response(JSON.stringify({ error: "OTP has expired. Please request a new one." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as verified
    await supabase.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);

    // Check if user exists in auth, if not create one
    const email = `${phone.replace("+", "")}@phone.vaanipay.app`;
    
    const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.find(u => u.email === email);

    let session = null;
    
    if (existingUser) {
      const { data: signInData, error: pwError } = await supabase.auth.signInWithPassword({
        email,
        password: `vp_${phone}_secure`,
      });
      
      console.log("Sign in result:", pwError ? pwError.message : "success");
      if (!pwError) {
        session = signInData.session;
      }
    } else {
      const { error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password: `vp_${phone}_secure`,
        email_confirm: true,
        user_metadata: { phone },
      });

      if (signUpError) {
        console.error("Sign up error:", signUpError);
        return new Response(JSON.stringify({ error: "Failed to create account" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: signInData } = await supabase.auth.signInWithPassword({
        email,
        password: `vp_${phone}_secure`,
      });
      session = signInData?.session;
    }

    // Clean up used OTPs
    await supabase.from("otp_codes").delete().eq("phone", phone);

    return new Response(JSON.stringify({ 
      success: true, 
      session,
      message: "OTP verified successfully" 
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
