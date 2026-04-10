import { ArrowLeft, MoreVertical, Contact, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import PaymentSuccess from "@/components/PaymentSuccess";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { speak, listenOnce, extractDigits, extractAmount } from "@/lib/voice";
import { authenticateWithBiometric } from "@/lib/biometric";

const askVoice = async (question: string, retries = 3): Promise<string> => {
  for (let i = 0; i < retries; i++) {
    await speak(question);
    try {
      const result = await listenOnce("en-IN");
      if (result && result.trim()) return result;
    } catch {}
    if (i < retries - 1) {
      question = "I didn't catch that. Please try again.";
    }
  }
  return "";
};

const PayPhone = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const hasAutoFilled = useRef(false);
  const hasVoiceStarted = useRef(false);

  useEffect(() => {
    if (hasAutoFilled.current) return;
    const state = location.state as { autoPhone?: string; autoAmount?: number } | null;
    if (state?.autoPhone) {
      hasAutoFilled.current = true;
      hasVoiceStarted.current = true;
      setPhoneNumber(state.autoPhone);
      if (state.autoAmount) setAmount(String(state.autoAmount));
      handleLookup(state.autoPhone);

      (async () => {
        await new Promise(r => setTimeout(r, 1000));
        if (state.autoAmount) {
          // No confirm — direct biometric
          await speak(`Sending ₹${state.autoAmount} to ${state.autoPhone}. Please authenticate.`);
          await doPay(state.autoPhone, String(state.autoAmount));
        } else {
          const amtAnswer = await askVoice(`Number ${state.autoPhone} entered. How much to send?`);
          const amt = extractAmount(amtAnswer);
          if (amt) {
            setAmount(String(amt));
            await speak(`Sending ₹${amt} to ${state.autoPhone}. Please authenticate.`);
            await doPay(state.autoPhone, String(amt));
          } else {
            const amt2Answer = await askVoice("Didn't get the amount. How much?");
            const amt2 = extractAmount(amt2Answer);
            if (amt2) {
              setAmount(String(amt2));
              await doPay(state.autoPhone, String(amt2));
            }
          }
        }
      })();
    }
  }, [location.state]);

  useEffect(() => {
    if (hasVoiceStarted.current) return;
    const state = location.state as { autoPhone?: string } | null;
    if (state?.autoPhone) return;
    hasVoiceStarted.current = true;

    const runVoice = async () => {
      let phone = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const prompt = attempt === 0
          ? "Pay by Phone. Say the 10 digit mobile number."
          : "Didn't get a valid number. Say it again slowly.";
        const phoneAnswer = await askVoice(prompt, 1);
        const digits = extractDigits(phoneAnswer);
        if (digits.length >= 10) {
          phone = digits.slice(0, 10);
          break;
        }
        if (digits.length > 0) {
          await speak(`Heard ${digits.length} digits. Need 10.`);
        }
      }

      if (!phone) {
        await speak("Couldn't get the number. Say it one more time.");
        const lastTry = await askVoice("Say the 10 digit number.", 1);
        const lastDigits = extractDigits(lastTry);
        if (lastDigits.length >= 10) phone = lastDigits.slice(0, 10);
      }

      if (!phone) {
        await speak("Still couldn't get the number. Please try again later.");
        return;
      }

      setPhoneNumber(phone);
      handleLookup(phone);

      // Ask amount, then direct biometric — no confirm
      const amtAnswer = await askVoice(`Number ${phone} entered. How much to send?`);
      const amt = extractAmount(amtAnswer);

      if (!amt) {
        const amt2Answer = await askVoice("Didn't catch the amount. Say it again.");
        const amt2 = extractAmount(amt2Answer);
        if (!amt2) {
          await speak("Couldn't get the amount. Please try again later.");
          return;
        }
        setAmount(String(amt2));
        await speak(`Sending ₹${amt2} to ${phone}. Please authenticate.`);
        await doPay(phone, String(amt2));
        return;
      }

      setAmount(String(amt));
      await speak(`Sending ₹${amt} to ${phone}. Please authenticate.`);
      await doPay(phone, String(amt));
    };

    setTimeout(runVoice, 800);
  }, [location.state]);

  const handleLookup = async (phone: string) => {
    setPhoneNumber(phone);
    if (phone.length === 10) {
      setLookupLoading(true);
      const fullPhone = `91${phone}`;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, phone")
        .eq("phone", fullPhone)
        .maybeSingle();
      setFoundUser(data);
      setLookupLoading(false);
      if (data) toast.success(`Found: ${data.display_name || data.phone}`);
    } else {
      setFoundUser(null);
    }
  };

  const doPay = async (phone: string, payAmount: string) => {
    const bioOk = await authenticateWithBiometric(`₹${payAmount}`);
    if (!bioOk) {
      await speak("Authentication cancelled.");
      return;
    }
    setPayLoading(true);
    try {
      if (foundUser?.id) {
        const payload = {
          amount: Number(payAmount),
          description: description || `Payment to +91${phone}`,
          receiver_id: foundUser.id,
        };
        const { data, error } = await supabase.functions.invoke("process-payment", { body: payload });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Payment failed");
      }

      await speak(`₹${payAmount} sent to ${phone} successfully!`);
      setShowSuccess(true);
    } catch (err: any) {
      await speak(`Payment failed. ${err.message || ""}`);
      toast.error(err.message || "Payment failed");
    } finally {
      setPayLoading(false);
    }
  };

  const handlePay = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    await doPay(phoneNumber, amount);
  };

  if (showSuccess) {
    return (
      <PaymentSuccess
        amount={amount}
        recipientName={foundUser?.display_name || `+91 ${phoneNumber}`}
        onClose={() => { setShowSuccess(false); setAmount(""); setFoundUser(null); setPhoneNumber(""); navigate("/"); }}
      />
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
            <h1 className="text-lg font-bold text-foreground">Pay Phone Number</h1>
          </div>
          <button className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 py-6">
          <p className="text-sm text-muted-foreground mb-6 animate-fade-in-up">Pay any mobile number instantly via UPI.</p>

          <div className="flex items-center gap-3 border-b-2 border-primary pb-2 mb-4 animate-fade-in-up stagger-1">
            <div className="flex items-center gap-2 border border-border rounded-lg px-2 py-1 bg-muted/50">
              <span className="text-sm">🇮🇳</span>
              <span className="text-sm font-semibold text-foreground">+91</span>
            </div>
            <input type="tel" placeholder="00000 00000" value={phoneNumber}
              onChange={(e) => handleLookup(e.target.value.replace(/[^0-9]/g, ""))}
              className="flex-1 bg-transparent text-xl font-bold text-foreground placeholder:text-muted-foreground focus:outline-none tracking-wider"
              maxLength={10} autoFocus />
            {lookupLoading && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <Contact className="w-6 h-6 text-primary" />
            </button>
          </div>

          {foundUser && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3 animate-scale-in">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-600 font-bold text-sm">{(foundUser.display_name || "U")[0].toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{foundUser.display_name || "VaaniPay User"}</p>
                <p className="text-xs text-muted-foreground">{foundUser.phone}</p>
              </div>
            </div>
          )}

          {phoneNumber.length === 10 && (
            <div className="animate-fade-in-up mb-4">
              <div className="flex items-center justify-center text-3xl font-bold text-foreground mb-4">
                <span className="text-muted-foreground mr-1">₹</span>
                <input type="text" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="0" className="w-28 bg-transparent outline-none text-center" />
              </div>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a note (optional)"
                className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none mb-4" />
            </div>
          )}

          <div className="animate-fade-in-up stagger-2">
            <button
              onClick={handlePay}
              disabled={phoneNumber.length < 10 || !amount || payLoading}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {payLoading ? "Processing..." : `Pay ₹${amount || "0"}`}
            </button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default PayPhone;
