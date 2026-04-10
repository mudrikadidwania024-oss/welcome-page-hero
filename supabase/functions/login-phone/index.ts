import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone || !/^\+91\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number. Use +91XXXXXXXXXX format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const email = `${phone.replace('+', '')}@vaanipay.app`;
    const tempPassword = `vp_${phone}_secret_key`;

    // Try to find existing user by email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    let user = users?.users?.find((u) => u.email === email);

    if (!user) {
      // Also check if there's a user with this phone number
      user = users?.users?.find((u) => u.phone === phone.replace('+', ''));

      if (user) {
        // Update existing phone-based user to have email
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email,
          email_confirm: true,
          password: tempPassword,
        });
        if (updateError) throw updateError;
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          password: tempPassword,
          phone,
          phone_confirm: true,
          user_metadata: { display_name: phone.slice(-10) },
        });
        if (createError) throw createError;
        user = newUser.user;
      }
    } else {
      // Ensure password is set
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: tempPassword,
      });
      if (updateError) throw updateError;
    }

    // Sign in
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password: tempPassword,
    });

    if (signInError) throw signInError;

    return new Response(
      JSON.stringify({ session: signInData.session }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
