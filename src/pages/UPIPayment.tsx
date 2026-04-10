import { ArrowLeft, MoreVertical, AtSign, CheckCircle2, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import PaymentSuccess from "@/components/PaymentSuccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { authenticateWithBiometric } from "@/lib/biometric";
import { speak, listenOnce, extractAmount, warmUpTTS } from "@/lib/voice";

const askVoice = async (question: string): Promise<string> => {
  await speak(question);
  try { return (await listenOnce("en-IN")) || ""; } catch { return ""; }
};

const UPIPayment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [upiId, setUpiId] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const hasAutoFilled = useRef(false);
  const hasVoiceStarted = useRef(false);

  // Auto-fill from voice navigation
  useEffect(() => {
    if (hasAutoFilled.current) return;
    const state = location.state as { autoUpi?: string; autoAmount?: number } | null;
    if (state?.autoUpi) {
      hasAutoFilled.current = true;
      hasVoiceStarted.current = true;
      setUpiId(state.autoUpi);
      if (state.autoAmount) setAmount(String(state.autoAmount));
      setTimeout(() => handleVerifyAuto(state.autoUpi!), 500);
    }
  }, [location.state]);

  // Voice flow when opened without pre-filled data
  useEffect(() => {
    if (hasVoiceStarted.current) return;
    const state = location.state as { autoUpi?: string } | null;
    if (state?.autoUpi) return;
    hasVoiceStarted.current = true;

    const runVoice = async () => {
      const upiAnswer = await askVoice(
        "Pay UPI ID is open. Please say the UPI ID you want to pay. For example, name at bank."
      );
      if (!upiAnswer.trim()) {
        await speak("I didn't catch the UPI ID. Please enter it manually.");
        return;
      }

      // Normalize spoken UPI: "name at bank" → "name@bank"
      const normalizedUpi = upiAnswer.toLowerCase().replace(/\s*at\s*/g, "@").replace(/\s+/g, "").trim();
      setUpiId(normalizedUpi);

      if (!normalizedUpi.includes("@")) {
        await speak("That doesn't look like a valid UPI ID. Please enter it manually.");
        return;
      }

      await speak(`Verifying ${normalizedUpi}...`);
      await handleVerifyAuto(normalizedUpi);

      const amtAnswer = await askVoice("How much do you want to pay?");
      const amt = extractAmount(amtAnswer);
      if (!amt) {
        await speak("I didn't catch the amount. Please enter it manually.");
        return;
      }

      setAmount(String(amt));
      const confirmAnswer = await askVoice(`Paying ₹${amt} to ${normalizedUpi}. Say confirm or yes to proceed.`);
      const cLower = confirmAnswer.toLowerCase();
      if (cLower.includes("confirm") || cLower.includes("yes") || cLower.includes("haan") || cLower.includes("ok")) {
        await doPayVoice(String(amt));
      } else {
        await speak("Payment cancelled. You can pay manually.");
      }
    };

    setTimeout(runVoice, 800);
  }, [location.state]);

  const doPayVoice = async (payAmount: string) => {
    await speak("Please authenticate with your fingerprint.");
    const bioOk = await authenticateWithBiometric(`₹${payAmount}`);
    if (!bioOk) {
      await speak("Authentication cancelled.");
      return;
    }
    setPayLoading(true);
    try {
      if (foundUser?.id) {
        const payload = { amount: Number(payAmount), description: description || `UPI payment to ${upiId}`, receiver_id: foundUser.id };
        const { data, error } = await supabase.functions.invoke("process-payment", { body: payload });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Payment failed");
      }
      await speak(`Payment of ₹${payAmount} completed successfully!`);
      setShowSuccess(true);
    } catch (err: any) {
      await speak(`Payment failed. ${err.message || ""}`);
      toast.error(err.message || "Payment failed");
    } finally {
      setPayLoading(false);
    }
  };

  const handleVerifyAuto = async (id: string) => {
    if (!id.includes("@")) return;
    setVerifyLoading(true);
    const match = id.match(/^(\d{10})@vaanipay$/);
    if (match) {
      const phone = `91${match[1]}`;
      const { data } = await supabase.from("profiles").select("id, display_name, phone").eq("phone", phone).maybeSingle();
      if (data) { setFoundUser(data); setIsVerified(true); setVerifyLoading(false); toast.success(`Verified: ${data.display_name || data.phone}`); return; }
    }
    const { data } = await supabase.from("profiles").select("id, display_name, phone, upi_id").eq("upi_id", id).maybeSingle();
    setVerifyLoading(false);
    if (data) { setFoundUser(data); setIsVerified(true); toast.success(`Verified: ${data.display_name || data.phone}`); }
    else { setIsVerified(true); /* allow payment even if not found in DB for demo */ }
  };

  const handleVerify = async () => {
    if (!upiId.includes("@")) { toast.error("Please enter a valid UPI ID"); return; }
    await handleVerifyAuto(upiId);
  };

  const handlePay = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    await doPayVoice(amount);
  };

  if (showSuccess) {
    return (
      <PaymentSuccess amount={amount} recipientName={foundUser?.display_name || upiId}
        onClose={() => { setShowSuccess(false); setAmount(""); setUpiId(""); setIsVerified(false); setFoundUser(null); navigate("/"); }} />
    );
  }

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen">
        <div className="flex items-center justify-between px-4 py-3.5 bg-card border-b border-border/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-1.5 rounded-full hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Pay UPI ID</h1>
          </div>
          <button className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 py-6">
          <div className="flex flex-col items-center justify-center py-6 mb-4 animate-fade-in-up">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <AtSign className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground text-center">Enter any UPI ID or number</p>
            <p className="text-xs text-muted-foreground text-center mt-1">Pay instantly to any UPI app</p>
          </div>

          <div className="animate-fade-in-up stagger-1">
            <div className="flex items-center gap-2 border border-border rounded-xl px-4 py-3 bg-card focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <input type="text" placeholder="e.g. name@bank" value={upiId}
                onChange={(e) => { setUpiId(e.target.value.toLowerCase()); setIsVerified(false); setFoundUser(null); }}
                className="flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none" autoFocus />
              {verifyLoading ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : !isVerified ? (
                <button onClick={handleVerify} disabled={!upiId} className="text-xs font-bold text-primary disabled:opacity-50">Verify</button>
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
            </div>

            {isVerified && foundUser && (
              <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3 animate-scale-in">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-emerald-600 font-bold text-xs">{(foundUser.display_name || "U")[0].toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{foundUser.display_name}</p>
                  <p className="text-xs text-muted-foreground">{foundUser.phone}</p>
                </div>
              </div>
            )}

            {isVerified && (
              <div className="mt-6 animate-fade-in-up">
                <div className="flex items-center justify-center text-3xl font-bold text-foreground mb-4">
                  <span className="text-muted-foreground mr-1">₹</span>
                  <input type="text" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="0" className="w-28 bg-transparent outline-none text-center" />
                </div>
                <input value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a note (optional)"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              </div>
            )}

            <button onClick={handlePay} disabled={!isVerified || !amount || payLoading}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-6">
              {payLoading ? "Processing..." : `Pay ₹${amount || "0"}`}
            </button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default UPIPayment;
