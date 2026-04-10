import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function respond(ok: boolean, payload: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify({ ok, ...payload }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get auth token from header
    const authHeader = req.headers.get("Authorization");
    let senderId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      // Skip if token is the anon key itself
      if (token !== anonKey) {
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (!userError && userData?.user) {
          senderId = userData.user.id;
        }
      }
    }

    // Also try apikey header for auth
    if (!senderId) {
      const apikeyHeader = req.headers.get("apikey");
      if (apikeyHeader && apikeyHeader !== anonKey) {
        const { data: userData } = await supabaseAdmin.auth.getUser(apikeyHeader);
        if (userData?.user) {
          senderId = userData.user.id;
        }
      }
    }

    if (!senderId) {
      console.error("No valid auth token found. Headers:", Object.fromEntries(req.headers.entries()));
      return respond(false, { error: "Unauthorized - please log in" }, 401);
    }

    const body = await req.json();
    const { receiver_id, receiver_phone, receiver_upi, amount, description } = body;

    console.log("Payment request:", { senderId, receiver_id, receiver_phone, receiver_upi, amount });

    if (!amount || amount <= 0) {
      return respond(false, { error: "Invalid payment amount" }, 400);
    }

    // Resolve receiver by ID, phone, or UPI
    let resolvedReceiverId = receiver_id;

    if (!resolvedReceiverId && receiver_phone) {
      const phoneCleaned = receiver_phone.replace(/[^0-9]/g, "");
      const last10 = phoneCleaned.slice(-10);
      const phoneVariants = [
        receiver_phone,
        phoneCleaned,
        `91${last10}`,
        `+91${last10}`,
        last10,
      ];
      for (const pv of [...new Set(phoneVariants)]) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("phone", pv)
          .maybeSingle();
        if (profile) { resolvedReceiverId = profile.id; break; }
      }
    }

    if (!resolvedReceiverId && receiver_upi) {
      const match = receiver_upi.match(/^(\d{10})@vaanipay$/);
      if (match) {
        const phoneVariants = [`91${match[1]}`, `+91${match[1]}`];
        for (const pv of phoneVariants) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("phone", pv)
            .maybeSingle();
          if (profile) { resolvedReceiverId = profile.id; break; }
        }
      }
      if (!resolvedReceiverId) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("upi_id", receiver_upi)
          .maybeSingle();
        if (profile) resolvedReceiverId = profile.id;
      }
    }

    if (!resolvedReceiverId) {
      return respond(false, { error: "Receiver not found" }, 400);
    }

    if (senderId === resolvedReceiverId) {
      return respond(false, { error: "Cannot send payment to yourself" }, 400);
    }

    // Check sender balance
    const { data: sender, error: senderError } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", senderId)
      .single();

    if (senderError || !sender) {
      return respond(false, { error: "Sender profile not found" }, 400);
    }

    if (Number(sender.balance) < amount) {
      return respond(false, { error: "Insufficient balance" }, 400);
    }

    // Check receiver exists
    const { data: receiver, error: receiverError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, balance")
      .eq("id", resolvedReceiverId)
      .single();

    if (receiverError || !receiver) {
      return respond(false, { error: "Receiver not found" }, 400);
    }

    // Deduct from sender
    const { error: deductError } = await supabaseAdmin
      .from("profiles")
      .update({ balance: Number(sender.balance) - amount })
      .eq("id", senderId);

    if (deductError) throw deductError;

    // Add to receiver
    const { error: addError } = await supabaseAdmin
      .from("profiles")
      .update({ balance: Number(receiver.balance) + amount })
      .eq("id", resolvedReceiverId);

    if (addError) throw addError;

    // Create transaction record
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        sender_id: senderId,
        receiver_id: resolvedReceiverId,
        amount,
        description: description || "",
        status: "completed",
      })
      .select()
      .single();

    if (txError) throw txError;

    return respond(true, {
      transaction,
      new_balance: Number(sender.balance) - amount,
      receiver_name: receiver.display_name,
    });
  } catch (error: any) {
    console.error("process-payment error:", error);
    return respond(false, { error: error.message || "Internal server error" }, 500);
  }
});
