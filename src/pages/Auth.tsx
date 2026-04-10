import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { speak, listenOnce, extractDigits, stopSpeaking, warmUpTTS } from "@/lib/voice";
import vaanipayLogo from "@/assets/vaanipay-logo.jpeg";
import { Mic, Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "speaking" | "listening" | "processing">("idle");
  const [voiceStarted, setVoiceStarted] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (voiceStarted) return;

    const handleFirstInteraction = () => {
      if (voiceStarted) return;
      setVoiceStarted(true);
      warmUpTTS();
      startVoiceLogin();
    };

    document.addEventListener("click", handleFirstInteraction, { once: true });
    document.addEventListener("touchstart", handleFirstInteraction, { once: true });
    document.addEventListener("keydown", handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("touchstart", handleFirstInteraction);
      document.removeEventListener("keydown", handleFirstInteraction);
    };
  }, [voiceStarted]);

  const startVoiceLogin = async () => {
    if (!isMounted.current) return;
    try {
      setVoiceStatus("speaking");
      // Shorter, faster prompt to reduce lag
      await speak("Welcome to VaaniPay. Say your 10 digit mobile number.", "en-IN");
      if (!isMounted.current) return;
      await listenForNumber();
    } catch (err: any) {
      if (err.message === "not-allowed") {
        toast.error("Microphone access denied.");
        setVoiceStatus("idle");
      } else {
        if (isMounted.current) {
          setVoiceStatus("speaking");
          await speak("Let me try again.", "en-IN");
          if (isMounted.current) await listenForNumber();
        }
      }
    }
  };

  const listenForNumber = async () => {
    if (!isMounted.current) return;

    for (let attempt = 0; attempt < 5; attempt++) {
      if (!isMounted.current) return;

      try {
        setVoiceStatus("listening");
        const result = await listenOnce("en-IN", 10000);
        if (!isMounted.current) return;

        if (!result) {
          setVoiceStatus("speaking");
          await speak("I didn't hear anything. Say your number.", "en-IN");
          continue;
        }

        const digits = extractDigits(result);

        if (digits.length < 10) {
          setVoiceStatus("speaking");
          await speak(`I heard ${digits.length} digits. I need 10. Try again.`, "en-IN");
          continue;
        }

        const phoneNumber = digits.slice(0, 10);
        setPhone(phoneNumber);

        setVoiceStatus("speaking");
        await speak(`Got it. ${phoneNumber.split("").join(" ")}. Logging in.`, "en-IN");

        await doLogin(phoneNumber);
        return;
      } catch (err: any) {
        if (err.message === "not-allowed") {
          toast.error("Microphone access denied.");
          setVoiceStatus("idle");
          return;
        }
        setVoiceStatus("speaking");
        await speak("Didn't catch that. Say your number.", "en-IN");
      }
    }

    setVoiceStatus("speaking");
    await speak("Having trouble hearing you. Tap the screen to try again.", "en-IN");
    setVoiceStatus("idle");
    setVoiceStarted(false);
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
        await speak("Login successful!", "en-IN");
        toast.success("Login successful!");
        navigate("/");
      } else {
        throw new Error("No session returned");
      }
    } catch (err: any) {
      setVoiceStatus("speaking");
      await speak(`Login failed. ${err.message || "Try again."}`, "en-IN");
      toast.error(err.message || "Login failed");
      if (isMounted.current) await listenForNumber();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label="Tap anywhere to start voice login"
    >
      <div className="w-full max-w-[430px] min-h-screen bg-card shadow-2xl flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="mb-8 animate-fade-in-up">
            <img src={vaanipayLogo} alt="VaaniPay" className="w-32 h-32 rounded-2xl object-cover shadow-lg" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1 animate-fade-in-up">Welcome to VaaniPay</h1>
          <p className="text-sm text-muted-foreground mb-2 animate-fade-in-up">
            {voiceStarted ? "Voice login active" : "Tap anywhere to start"}
          </p>

          <div className="mb-4 flex items-center gap-2 text-sm font-medium animate-fade-in-up min-h-[28px]">
            {voiceStatus === "idle" && !voiceStarted && (
              <span className="text-primary flex items-center gap-1.5 animate-pulse">
                <Mic className="w-4 h-4" />
                Tap anywhere to begin
              </span>
            )}
            {voiceStatus === "speaking" && (
              <span className="text-primary flex items-center gap-1.5">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Speaking...
              </span>
            )}
            {voiceStatus === "listening" && (
              <span className="text-destructive flex items-center gap-1.5">
                <Mic className="w-4 h-4 animate-pulse" />
                Listening...
              </span>
            )}
            {voiceStatus === "processing" && (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                Logging in...
              </span>
            )}
          </div>

          <div className="w-full space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-3 border-2 border-border rounded-xl px-4 py-3 focus-within:border-primary transition-colors">
              <div className="flex items-center gap-1.5 border-r border-border pr-3">
                <span className="text-base">🇮🇳</span>
                <span className="text-sm font-semibold text-foreground">+91</span>
              </div>
              <input
                type="tel"
                placeholder="Voice input active"
                value={phone}
                readOnly
                className="flex-1 bg-transparent text-lg font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none tracking-wider"
                maxLength={10}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1 bg-primary/20 text-primary font-bold py-3.5 rounded-xl text-center text-base">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Logging in...
                  </span>
                ) : voiceStarted ? (
                  "Voice login in progress..."
                ) : (
                  "Tap screen to start"
                )}
              </div>
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
