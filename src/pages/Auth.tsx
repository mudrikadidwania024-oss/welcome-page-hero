import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { speak, listenOnce, extractDigits, stopSpeaking, warmUpTTS } from "@/lib/voice";
import vaanipayLogo from "@/assets/vaanipay-logo.jpeg";
import { Mic, MicOff, Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "speaking" | "listening" | "processing">("idle");
  const hasGreeted = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Don't auto-start voice on mount — it will be blocked by browser gesture policy.
  // User must tap the mic button to start voice login.

  const startVoiceLogin = async () => {
    if (!isMounted.current) return;
    try {
      setVoiceStatus("speaking");
      await speak("Welcome to VaaniPay. Please tell me your 10 digit mobile number.");
      
      if (!isMounted.current) return;
      await listenForNumber();
    } catch (err: any) {
      console.error("Voice login error:", err);
      if (err.message === "not-allowed") {
        toast.error("Microphone access denied. Please allow microphone and try again.");
        setVoiceStatus("idle");
      } else {
        // Auto-retry after a brief pause
        if (isMounted.current) {
          setVoiceStatus("speaking");
          await speak("Let me try again.");
          if (isMounted.current) await listenForNumber();
        }
      }
    }
  };

  const listenForNumber = async () => {
    if (!isMounted.current) return;
    try {
      setVoiceStatus("listening");
      const result = await listenOnce("en-IN");
      
      if (!isMounted.current) return;

      if (!result) {
        // No speech detected - auto retry
        setVoiceStatus("speaking");
        await speak("I didn't hear anything. Please say your mobile number.");
        if (isMounted.current) await listenForNumber();
        return;
      }

      const digits = extractDigits(result);
      
      if (digits.length < 10) {
        setVoiceStatus("speaking");
        await speak(`I heard ${digits.length} digits. I need 10 digits. Please try again.`);
        if (isMounted.current) await listenForNumber();
        return;
      }

      const phoneNumber = digits.slice(0, 10);
      setPhone(phoneNumber);
      
      setVoiceStatus("speaking");
      await speak(`I heard ${phoneNumber.split("").join(" ")}. Logging you in.`);
      
      await doLogin(phoneNumber);
    } catch (err: any) {
      console.error("Listen error:", err);
      if (err.message === "not-allowed") {
        toast.error("Microphone access denied.");
        setVoiceStatus("idle");
      } else if (err.message === "no-speech" || err.message === "aborted") {
        // Auto retry on no-speech
        if (isMounted.current) {
          setVoiceStatus("speaking");
          await speak("I didn't catch that. Please say your number.");
          if (isMounted.current) await listenForNumber();
        }
      } else {
        setVoiceStatus("idle");
      }
    }
  };

  const doLogin = async (phoneNum: string) => {
    setLoading(true);
    setVoiceStatus("processing");
    try {
      const { data, error } = await supabase.functions.invoke("login-phone", {
        body: { phone: `+91${phoneNum}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        setVoiceStatus("speaking");
        await speak("Login successful! Welcome back.");
        toast.success("Login successful!");
        navigate("/");
      } else {
        throw new Error("No session returned");
      }
    } catch (err: any) {
      setVoiceStatus("speaking");
      await speak(`Login failed. ${err.message || "Please try again."}`);
      toast.error(err.message || "Login failed");
      // Auto retry after failed login
      if (isMounted.current) await listenForNumber();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    warmUpTTS();
    if (phone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    await doLogin(phone);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-[430px] min-h-screen bg-card shadow-2xl flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="mb-8 animate-fade-in-up">
            <img
              src={vaanipayLogo}
              alt="VaaniPay"
              className="w-32 h-32 rounded-2xl object-cover shadow-lg"
            />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1 animate-fade-in-up">
            Welcome to VaaniPay
          </h1>
          <p className="text-sm text-muted-foreground mb-2 animate-fade-in-up">
            Login with your mobile number
          </p>

          {voiceStatus !== "idle" && (
            <div className="mb-4 flex items-center gap-2 text-sm font-medium animate-fade-in-up">
              {voiceStatus === "speaking" && (
                <span className="text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  Speaking...
                </span>
              )}
              {voiceStatus === "listening" && (
                <span className="text-destructive flex items-center gap-1.5">
                  <Mic className="w-4 h-4 animate-pulse" />
                  Listening for your number...
                </span>
              )}
              {voiceStatus === "processing" && (
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Logging in...
                </span>
              )}
            </div>
          )}

          <div className="w-full space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-3 border-2 border-border rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
              <div className="flex items-center gap-1.5 border-r border-border pr-3">
                <span className="text-base">🇮🇳</span>
                <span className="text-sm font-semibold text-foreground">+91</span>
              </div>
              <input
                type="tel"
                placeholder="Enter mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                className="flex-1 bg-transparent text-lg font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none tracking-wider"
                maxLength={10}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLogin}
                disabled={phone.length < 10 || loading}
                className="flex-1 bg-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] text-base"
              >
                {loading ? "Logging in..." : "Login"}
              </button>
              <button
                onClick={() => { warmUpTTS(); startVoiceLogin(); }}
                disabled={loading || voiceStatus === "listening" || voiceStatus === "speaking"}
                className="w-14 h-14 rounded-xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors disabled:opacity-50"
                aria-label="Voice login"
              >
                {voiceStatus === "listening" ? (
                  <MicOff className="w-5 h-5 text-destructive" />
                ) : (
                  <Mic className="w-5 h-5 text-primary" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="pb-8 pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            By continuing, you agree to VaaniPay's Terms & Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
