import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Volume2, Loader2, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { speak, stopSpeaking, listenOnce, extractDigits, extractAmount, warmUpTTS } from "@/lib/voice";
import { authenticateWithBiometric } from "@/lib/biometric";

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const ROUTE_PATTERNS: { keywords: string[]; route: string; label: string; announcement?: string }[] = [
  { keywords: ["scan", "qr", "scanner"], route: "/scan", label: "QR scanner", announcement: "QR scanner is open. Point your camera at a QR code to scan." },
  { keywords: ["pay contact", "send money", "pay someone", "contacts", "contact"], route: "/pay-contact", label: "Pay Contact", announcement: "Pay Contacts is open." },
  { keywords: ["pay phone", "phone pay", "mobile pay", "pay by phone", "pay number"], route: "/pay-phone", label: "Pay by Phone", announcement: "Pay by Phone is open." },
  { keywords: ["bank transfer", "neft", "imps"], route: "/bank-transfer", label: "Bank Transfer", announcement: "Bank Transfer is open." },
  { keywords: ["upi", "upi payment", "upi id"], route: "/upi", label: "UPI Payment", announcement: "UPI Payment is open." },
  { keywords: ["self transfer", "self"], route: "/self-transfer", label: "Self Transfer", announcement: "Self Transfer is open." },
  { keywords: ["pay bill", "bill", "electricity", "water bill", "bills"], route: "/pay-bills", label: "Bill Payments", announcement: "Bill Payments is open." },
  { keywords: ["recharge", "mobile recharge", "prepaid"], route: "/recharge", label: "Recharge", announcement: "Recharge is open." },
  { keywords: ["history", "transaction", "past payment", "transactions"], route: "/history", label: "Transaction History", announcement: "Transaction History is open." },
  { keywords: ["profile", "account", "settings", "my profile"], route: "/profile", label: "Profile", announcement: "Profile page is open." },
  { keywords: ["balance page", "balance detail"], route: "/balance", label: "Balance page", announcement: "Balance page is open." },
  { keywords: ["home", "main", "dashboard", "go back"], route: "/", label: "Home", announcement: "You are on the home page." },
];

const defaultContacts = [
  { name: "Aarav Patel", phone: "+91 98765 43210" },
  { name: "Amit Singh", phone: "+91 98765 43211" },
  { name: "Diya Rangarajan", phone: "+91 98765 43212" },
  { name: "Inayat Verma", phone: "+91 98765 43213" },
  { name: "Neha Gupta", phone: "+91 98765 43214" },
  { name: "Priya Sharma", phone: "+91 98765 43215" },
  { name: "Rishi Goli", phone: "+91 98765 43216" },
  { name: "Sahil Sehgal", phone: "+91 98765 43217" },
];

const billCategories = [
  { keywords: ["electricity", "electric", "bijli", "bescom", "light"], label: "Electricity", provider: "BESCOM" },
  { keywords: ["water", "pani", "bwssb", "jal"], label: "Water", provider: "BWSSB" },
  { keywords: ["gas", "piped gas", "gail", "cooking gas"], label: "Piped Gas", provider: "GAIL Gas" },
  { keywords: ["broadband", "internet", "wifi", "act", "net"], label: "Broadband", provider: "ACT Fibernet" },
  { keywords: ["dth", "tata play", "dish", "tv"], label: "DTH", provider: "Tata Play" },
  { keywords: ["credit card", "card", "credit"], label: "Credit Card", provider: "HDFC Card" },
];

const VoiceAssistant = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [responseText, setResponseText] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);
  const recognitionRef = useRef<any>(null);
  const hasAutoStarted = useRef(false);
  const shouldAutoListen = useRef(true);

  // Auto-start voice assistant immediately after login — no click needed
  // We use a short delay to let the page render, then auto-activate
  useEffect(() => {
    if (!user || hasAutoStarted.current) return;
    if (location.pathname === "/auth") return;

    const autoActivate = () => {
      if (hasAutoStarted.current) return;
      hasAutoStarted.current = true;
      warmUpTTS();
      setShowOverlay(true);
      speakAndShow("Welcome to VaaniPay. What would you like to do? You can say: send money, pay bills, check balance, scan QR, or recharge.").then(() => {
        autoStartListening();
      });
    };

    // Try to auto-start after a short delay. Browser may block audio without gesture,
    // so also listen for first interaction as fallback.
    const timer = setTimeout(autoActivate, 800);
    const events = ["click", "touchstart", "keydown"];
    events.forEach(e => document.addEventListener(e, autoActivate, { once: true }));

    return () => {
      clearTimeout(timer);
      events.forEach(e => document.removeEventListener(e, autoActivate));
    };
  }, [user, location.pathname]);

  const speakAndShow = useCallback(async (text: string) => {
    setIsSpeaking(true);
    setResponseText(text);
    await speak(text);
    setIsSpeaking(false);
  }, []);

  const autoStartListening = useCallback(() => {
    if (!SpeechRecognition || !shouldAutoListen.current) return;
    setTimeout(() => startListening(), 500);
  }, []);

  const fetchBalance = useCallback(async (): Promise<string> => {
    if (!user) return "0";
    const { data } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .maybeSingle();
    return data ? String(data.balance) : "0";
  }, [user]);

  const fetchTransactionHistory = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase
      .from("transactions")
      .select(`
        *,
        sender:profiles!transactions_sender_id_fkey(display_name, phone),
        receiver:profiles!transactions_receiver_id_fkey(display_name, phone)
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20);
    return data || [];
  }, [user]);

  const askAndListen = useCallback(async (question: string, retries = 2): Promise<string> => {
    for (let i = 0; i < retries; i++) {
      const prompt = i === 0 ? question : "I didn't catch that. Please say it again.";
      await speakAndShow(prompt);
      setIsListening(true);
      try {
        const result = await listenOnce("en-IN");
        setIsListening(false);
        if (result && result.trim()) return result;
      } catch {
        setIsListening(false);
      }
    }
    return "";
  }, [speakAndShow]);

  const processCommand = useCallback(async (text: string) => {
    setIsProcessing(true);
    setTranscript(text);
    const lowerText = text.toLowerCase().trim();

    try {
      // ===== BALANCE CHECK (now requires biometric) =====
      if (lowerText.includes("balance") || lowerText.includes("how much") || lowerText.includes("kitna") || lowerText.includes("paisa") || lowerText.includes("money left") || lowerText.includes("account")) {
        await speakAndShow("Please authenticate to check your balance.");
        const bioOk = await authenticateWithBiometric("balance check");
        if (bioOk) {
          const balance = await fetchBalance();
          await speakAndShow(`Your current balance is ₹${Number(balance).toLocaleString("en-IN")}`);
        } else {
          await speakAndShow("Authentication cancelled.");
        }
        setIsProcessing(false);
        autoStartListening();
        return;
      }

      // ===== LAST TRANSACTION =====
      if (lowerText.includes("last transaction") || lowerText.includes("recent transaction") || lowerText.includes("latest transaction") || lowerText.includes("last payment")) {
        const txns = await fetchTransactionHistory();
        if (txns.length > 0) {
          const tx = txns[0];
          const isSender = tx.sender_id === user?.id;
          const other = isSender ? tx.receiver : tx.sender;
          const name = other?.display_name || other?.phone || "someone";
          const amt = Number(tx.amount).toLocaleString("en-IN");
          const date = new Date(tx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
          const verb = isSender ? "sent" : "received";
          await speakAndShow(`Your last transaction: You ${verb} ₹${amt} ${isSender ? "to" : "from"} ${name} on ${date}`);
        } else {
          await speakAndShow("You have no transactions yet.");
        }
        setIsProcessing(false);
        autoStartListening();
        return;
      }

      // ===== TOTAL SPENT =====
      if (lowerText.includes("total spent") || lowerText.includes("how much have i spent") || lowerText.includes("total spending")) {
        const txns = await fetchTransactionHistory();
        const total = txns
          .filter(tx => tx.sender_id === user?.id)
          .reduce((s: number, tx: any) => s + Number(tx.amount), 0);
        await speakAndShow(`Your total spending is ₹${total.toLocaleString("en-IN")}`);
        setIsProcessing(false);
        autoStartListening();
        return;
      }

      // ===== PAY BILLS BY VOICE (no confirm, direct biometric) =====
      const billMatch = lowerText.match(/(?:pay|bill|pay\s+(?:my\s+)?|bharo\s+)(electricity|water|gas|broadband|internet|wifi|dth|credit\s*card|bijli|pani|light|tv|net)\s*(?:bill|ka\s+bill)?/i);
      if (billMatch || lowerText.includes("pay bill") || lowerText.includes("bill payment") || lowerText.includes("bill bharo")) {
        let category = billMatch ? billMatch[1].toLowerCase() : null;
        
        if (!category) {
          const answer = await askAndListen("Which bill? Electricity, water, gas, broadband, DTH, or credit card?");
          category = answer.toLowerCase();
        }

        const found = billCategories.find(b => b.keywords.some(k => category!.includes(k)));
        if (found) {
          const amountAnswer = await askAndListen(`How much for ${found.label}?`);
          const amt = extractAmount(amountAnswer);
          
          const idAnswer = await askAndListen("Please say your consumer or account ID.");
          const consumerId = idAnswer.trim();

          if (amt && consumerId) {
            await speakAndShow(`Paying ₹${amt} for ${found.label}. Please authenticate.`);
            navigate("/pay-bills", { state: { autoBill: found.label, autoAmount: amt, autoConsumerId: consumerId, autoConfirm: true } });
          } else {
            await speakAndShow("Couldn't get details. Opening bill payments.");
            navigate("/pay-bills");
          }
          setTimeout(() => setShowOverlay(false), 1500);
        } else {
          await speakAndShow("Opening bill payments.");
          navigate("/pay-bills");
          setTimeout(() => setShowOverlay(false), 1500);
        }
        setIsProcessing(false);
        return;
      }

      // ===== RECHARGE BY VOICE (no confirm, direct biometric) =====
      if (lowerText.includes("recharge") || lowerText.includes("prepaid") || lowerText.includes("top up") || lowerText.includes("topup")) {
        const phoneAnswer = await askAndListen("Which mobile number to recharge?");
        const digits = extractDigits(phoneAnswer);
        const rechargePhone = digits.length >= 10 ? digits.slice(0, 10) : "";

        if (rechargePhone) {
          const operatorAnswer = await askAndListen("Which operator? Jio, Airtel, Vi, or BSNL?");
          const operator = operatorAnswer.trim();

          const amtAnswer = await askAndListen("How much to recharge?");
          const amt = extractAmount(amtAnswer);

          if (amt) {
            await speakAndShow(`Recharging ${rechargePhone} on ${operator} for ₹${amt}. Please authenticate.`);
            navigate("/recharge", { state: { autoPhone: rechargePhone, autoOperator: operator, autoAmount: amt, autoConfirm: true } });
          } else {
            await speakAndShow(`Opening recharge for ${rechargePhone}.`);
            navigate("/recharge", { state: { autoPhone: rechargePhone, autoOperator: operator } });
          }
          setTimeout(() => setShowOverlay(false), 1500);
        } else {
          await speakAndShow("Opening recharge page.");
          navigate("/recharge");
          setTimeout(() => setShowOverlay(false), 1500);
        }
        setIsProcessing(false);
        return;
      }

      // ===== PAY / SEND MONEY (no confirm step, direct biometric) =====
      const payMatch = lowerText.match(/(?:send|pay|transfer|give|bhejo|de\s*do|dena)\s+(?:rs\.?|₹|rupees?|rupay|rupaiye)?\s*(\d+)\s+(?:to|ko|for)\s+(.+)/i);
      const payMatch2 = !payMatch ? lowerText.match(/(?:send|pay|transfer|give|bhejo|de\s*do|dena)\s+(?:rs\.?|₹|rupees?|rupay|rupaiye)?\s*(\d+)\s+(.+)/i) : null;
      const payMatch3 = !payMatch && !payMatch2 ? lowerText.match(/(?:send|pay|transfer|give|bhejo)\s+(?:money\s+)?(?:to\s+)?(.+?)(?:\s+(\d+))?$/i) : null;
      
      if (payMatch || payMatch2 || payMatch3) {
        const amount = payMatch ? parseInt(payMatch[1], 10) 
          : payMatch2 ? parseInt(payMatch2[1], 10) 
          : (payMatch3?.[2] ? parseInt(payMatch3[2], 10) : null);
        let recipient = payMatch ? payMatch[2].trim() 
          : payMatch2 ? payMatch2[2].replace(/^(?:to|ko|for)\s+/i, "").trim()
          : payMatch3?.[1]?.replace(/^to\s+/i, "").trim() || "";

        recipient = recipient.replace(/\s*(rupees?|rupay|rupaiye|rs\.?)\s*/gi, "").trim();

        if (!recipient || recipient.length < 2) {
          await speakAndShow("Sorry, I didn't catch the name. Please try again.");
          setIsProcessing(false);
          autoStartListening();
          return;
        }

        const foundContact = defaultContacts.find(c => c.name.toLowerCase().includes(recipient.toLowerCase()));

        if (foundContact) {
          let finalAmount = amount || null;

          if (!finalAmount) {
            const amtAnswer = await askAndListen(`How much to send to ${foundContact.name}?`);
            finalAmount = extractAmount(amtAnswer);
          }

          if (finalAmount) {
            // No confirm step — go straight to biometric + payment
            await speakAndShow(`Sending ₹${finalAmount} to ${foundContact.name}. Please authenticate.`);
            navigate("/pay-contact", { state: { autoPayName: foundContact.name, autoPayAmount: finalAmount, autoConfirm: true } });
          } else {
            await speakAndShow(`Opening payment to ${foundContact.name}.`);
            navigate("/pay-contact", { state: { autoPayName: foundContact.name } });
          }
          setTimeout(() => setShowOverlay(false), 1500);
        } else {
          const answer = await askAndListen(`${recipient} not found. Pay by mobile number or UPI? Say mobile or UPI.`);
          const answerLower = answer.toLowerCase();

          if (answerLower.includes("mobile") || answerLower.includes("phone") || answerLower.includes("number")) {
            const phoneAnswer = await askAndListen("Say the 10 digit mobile number.");
            const digits = extractDigits(phoneAnswer);
            const phoneNum = digits.length >= 10 ? digits.slice(0, 10) : "";
            
            if (phoneNum) {
              await speakAndShow(`Opening payment to ${phoneNum}.`);
              navigate("/pay-phone", { state: { autoPhone: phoneNum, autoAmount: amount } });
            } else {
              await speakAndShow("Couldn't get the number. Opening pay by phone.");
              navigate("/pay-phone");
            }
            setTimeout(() => setShowOverlay(false), 1500);
          } else if (answerLower.includes("upi")) {
            const upiAnswer = await askAndListen("Say the UPI ID.");
            const upiId = upiAnswer.trim().replace(/\s+/g, "");

            if (upiId) {
              await speakAndShow(`Opening UPI payment to ${upiId}.`);
              navigate("/upi", { state: { autoUpi: upiId, autoAmount: amount } });
            } else {
              await speakAndShow("Opening UPI payment page.");
              navigate("/upi");
            }
            setTimeout(() => setShowOverlay(false), 1500);
          } else {
            await speakAndShow("Opening pay contacts.");
            navigate("/pay-contact", { state: { autoPayName: recipient, autoPayAmount: amount } });
            setTimeout(() => setShowOverlay(false), 1500);
          }
        }
        setIsProcessing(false);
        return;
      }

      // ===== NAVIGATION =====
      for (const pattern of ROUTE_PATTERNS) {
        if (pattern.keywords.some((kw) => lowerText.includes(kw))) {
          await speakAndShow(pattern.announcement || `Opening ${pattern.label}`);
          setTimeout(() => {
            navigate(pattern.route);
            setShowOverlay(false);
          }, 1200);
          setIsProcessing(false);
          return;
        }
      }

      const openMatch = lowerText.match(/(?:open|go to|show|navigate to|kholo|dikhao)\s+(.+)/i);
      if (openMatch) {
        const target = openMatch[1].trim().toLowerCase();
        for (const pattern of ROUTE_PATTERNS) {
          if (pattern.keywords.some((kw) => target.includes(kw) || kw.includes(target))) {
            await speakAndShow(pattern.announcement || `Opening ${pattern.label}`);
            setTimeout(() => {
              navigate(pattern.route);
              setShowOverlay(false);
            }, 1200);
            setIsProcessing(false);
            return;
          }
        }
      }

      await speakAndShow("Sorry, I didn't understand. Try: send 500 to Rahul, pay electricity bill, recharge, or check balance.");
      setIsProcessing(false);
      autoStartListening();
    } catch (err) {
      console.error("Command error:", err);
      await speakAndShow("Something went wrong. Please try again.");
      setIsProcessing(false);
      autoStartListening();
    }
  }, [user, navigate, fetchBalance, fetchTransactionHistory, speakAndShow, askAndListen, autoStartListening]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported. Please use Chrome.");
      return;
    }

    setShowOverlay(true);
    setTranscript("");
    setResponseText("");
    setIsListening(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (interimTranscript) setTranscript(interimTranscript);

      if (finalTranscript) {
        setTranscript(finalTranscript);
        setIsListening(false);
        processCommand(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Please allow microphone.");
      } else {
        autoStartListening();
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Recognition start error:", err);
      setIsListening(false);
    }
  }, [processCommand, autoStartListening]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    recognitionRef.current?.stop();
  }, []);

  const closeOverlay = useCallback(() => {
    shouldAutoListen.current = false;
    stopListening();
    stopSpeaking();
    setShowOverlay(false);
    setTranscript("");
    setResponseText("");
    setIsProcessing(false);
    setIsSpeaking(false);
    setTimeout(() => { shouldAutoListen.current = true; }, 1000);
  }, [stopListening]);

  if (location.pathname === "/auth" || !user) return null;

  return (
    <>
      <button
        onClick={() => {
          warmUpTTS();
          setShowOverlay(true);
          speakAndShow("VaaniPay is ready. What would you like to do?").then(() => {
            autoStartListening();
          });
        }}
        className="fixed bottom-24 right-5 z-50 w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform animate-pulse"
        aria-label="Voice assistant"
      >
        <Mic className="w-6 h-6 text-primary-foreground" />
      </button>

      {showOverlay && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-fade-in">
          <button onClick={closeOverlay} className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          <div className="relative mb-8">
            <div className={cn(
              "w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300",
              isListening ? "bg-destructive/20 animate-pulse" : isSpeaking ? "bg-accent/20" : "bg-primary/20"
            )}>
              <div
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer",
                  isListening ? "bg-destructive shadow-[0_0_30px_rgba(239,68,68,0.4)]" : isSpeaking ? "bg-accent" : "bg-primary"
                )}
                onClick={isListening ? stopListening : (!isProcessing && !isSpeaking ? startListening : undefined)}
              >
                {isListening ? (
                  <MicOff className="w-8 h-8 text-white" />
                ) : isProcessing ? (
                  <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
                ) : isSpeaking ? (
                  <Volume2 className="w-8 h-8 text-primary-foreground" />
                ) : (
                  <Mic className="w-8 h-8 text-primary-foreground" />
                )}
              </div>
            </div>
          </div>

          <p className="text-lg font-semibold text-foreground mb-2">
            {isListening ? "Listening..." : isProcessing ? "Processing..." : isSpeaking ? "Speaking..." : "Tap mic to speak"}
          </p>

          {transcript && (
            <div className="bg-muted rounded-xl px-4 py-3 max-w-xs text-center mb-3">
              <p className="text-xs text-muted-foreground mb-1">You said:</p>
              <p className="text-sm font-medium text-foreground">{transcript}</p>
            </div>
          )}

          {responseText && (
            <div className="bg-primary/10 rounded-xl px-4 py-3 max-w-xs text-center">
              <p className="text-xs text-primary mb-1">Assistant:</p>
              <p className="text-sm font-medium text-foreground">{responseText}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-6 text-center max-w-xs">
            Try: "Send 500 to Rahul", "Pay electricity bill", "Recharge", "Check balance"
          </p>
        </div>
      )}
    </>
  );
};

export default VoiceAssistant;
