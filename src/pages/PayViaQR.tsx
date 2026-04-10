import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MobileLayout from "@/components/MobileLayout";
import PaymentSuccess from "@/components/PaymentSuccess";
import { toast } from "sonner";
import { speak, listenOnce, extractAmount } from "@/lib/voice";
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

const PayViaQR = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const qrCodeId = searchParams.get("qr");

  const [receiver, setReceiver] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const hasSpoken = useRef(false);

  useEffect(() => {
    if (qrCodeId) fetchReceiver();
  }, [qrCodeId]);

  const fetchReceiver = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, phone, qr_code_id")
      .eq("qr_code_id", qrCodeId)
      .single();

    if (error || !data) {
      toast.error("Invalid QR code");
      await speak("Invalid QR code.");
      navigate("/");
      return;
    }
    if (data.id === user?.id) {
      toast.error("You cannot pay yourself!");
      await speak("You cannot pay yourself.");
      navigate("/");
      return;
    }
    setReceiver(data);

    if (!hasSpoken.current) {
      hasSpoken.current = true;
      const name = data.display_name || data.phone || "this user";

      // Ask amount, then direct biometric — no confirm
      const amtAnswer = await askVoice(`Paying ${name}. How much to send?`);
      const amt = extractAmount(amtAnswer);

      if (amt && amt > 0) {
        setAmount(String(amt));
        await speak(`Sending ₹${amt} to ${name}. Please authenticate.`);
        await doPayVoice(data, amt);
      } else {
        const amt2Answer = await askVoice(`Didn't get the amount. How much for ${name}?`);
        const amt2 = extractAmount(amt2Answer);
        if (amt2 && amt2 > 0) {
          setAmount(String(amt2));
          await speak(`Sending ₹${amt2} to ${name}. Please authenticate.`);
          await doPayVoice(data, amt2);
        } else {
          await speak("Couldn't get the amount. You can use the form.");
        }
      }
    }
  };

  const doPayVoice = async (receiverData: any, payAmount: number) => {
    const bioOk = await authenticateWithBiometric(`₹${payAmount}`);
    if (!bioOk) {
      await speak("Authentication cancelled.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          receiver_id: receiverData.id,
          amount: payAmount,
          description: description || `Payment to ${receiverData.display_name}`,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Payment failed");

      await speak(`₹${payAmount} sent to ${receiverData.display_name || "the recipient"} successfully!`);
      setShowSuccess(true);
    } catch (err: any) {
      await speak(`Payment failed. ${err.message || ""}`);
      toast.error(err.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    const bioOk = await authenticateWithBiometric(`₹${amount}`);
    if (!bioOk) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          receiver_id: receiver.id,
          amount: numAmount,
          description: description || `Payment to ${receiver.display_name}`,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Payment failed");

      await speak(`₹${numAmount} sent successfully!`);
      setShowSuccess(true);
    } catch (err: any) {
      await speak(`Payment failed. ${err.message || ""}`);
      toast.error(err.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <PaymentSuccess
        amount={amount}
        recipientName={receiver?.display_name || receiver?.phone}
        onClose={() => navigate("/")}
      />
    );
  }

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen">
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Send Payment</h1>
        </div>

        <div className="flex-1 px-6 pt-6">
          {receiver ? (
            <div className="space-y-6 animate-fade-in-up">
              <div className="bg-card rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">
                    {(receiver.display_name || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{receiver.display_name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{receiver.phone}</p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-3">Enter Amount</p>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-4xl font-bold text-foreground">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="text-5xl font-bold text-foreground bg-transparent outline-none w-48 text-center"
                    autoFocus
                  />
                </div>
              </div>

              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a note (optional)"
                className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />

              <button
                onClick={handlePay}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl disabled:opacity-50 transition-all active:scale-[0.98] text-lg"
              >
                {loading ? "Processing..." : `Pay ₹${amount || "0"}`}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center pt-20">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
};

export default PayViaQR;
