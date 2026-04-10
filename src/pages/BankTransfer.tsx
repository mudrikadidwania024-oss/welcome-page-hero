import { ArrowLeft, MoreVertical, Building2, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import PaymentSuccess from "@/components/PaymentSuccess";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
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

const BankTransfer = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    accountNumber: "",
    reAccountNumber: "",
    ifsc: "",
    name: ""
  });
  const [amount, setAmount] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const hasVoiceStarted = useRef(false);

  useEffect(() => {
    if (hasVoiceStarted.current) return;
    hasVoiceStarted.current = true;

    const runVoice = async () => {
      await speak("Bank Transfer. I'll guide you step by step.");

      // Account number
      let acDigits = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const prompt = attempt === 0 ? "Say the account number." : "Didn't catch it. Say it again digit by digit.";
        const acAnswer = await askVoice(prompt, 1);
        const digits = extractDigits(acAnswer);
        if (digits.length >= 6) { acDigits = digits; break; }
        if (digits.length > 0) await speak(`Heard ${digits.length} digits. Need at least 6.`);
      }

      if (acDigits.length < 6) {
        await speak("Couldn't get account number. Try again later.");
        return;
      }

      setFormData(prev => ({ ...prev, accountNumber: acDigits, reAccountNumber: acDigits }));
      await speak(`Account number: ${acDigits.split("").join(" ")}.`);

      // IFSC
      let ifsc = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const prompt = attempt === 0 ? "Say the IFSC code letter by letter." : "Didn't catch IFSC. Spell it slowly.";
        const ifscAnswer = await askVoice(prompt, 1);
        const cleaned = ifscAnswer.replace(/\s+/g, "").toUpperCase();
        if (cleaned.length >= 4) { ifsc = cleaned; break; }
      }

      if (!ifsc) {
        await speak("Couldn't get IFSC. Try again later.");
        return;
      }

      setFormData(prev => ({ ...prev, ifsc }));
      await speak(`IFSC: ${ifsc}.`);

      // Name
      let holderName = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const prompt = attempt === 0 ? "Say the account holder name." : "Didn't catch the name. Say it again.";
        const nameAnswer = await askVoice(prompt, 1);
        if (nameAnswer.trim().length >= 2) { holderName = nameAnswer.trim(); break; }
      }

      if (!holderName) {
        await speak("Couldn't get the name. Try again later.");
        return;
      }

      setFormData(prev => ({ ...prev, name: holderName }));

      // Amount
      let transferAmt: number | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const prompt = attempt === 0 ? "How much to transfer?" : "Didn't catch amount. Say it again.";
        const amtAnswer = await askVoice(prompt, 1);
        transferAmt = extractAmount(amtAnswer);
        if (transferAmt && transferAmt > 0) break;
        transferAmt = null;
      }

      if (!transferAmt) {
        await speak("Couldn't get the amount. Try again later.");
        return;
      }

      setAmount(String(transferAmt));

      // No confirm — direct biometric
      await speak(`Transferring ₹${transferAmt} to ${holderName}. Please authenticate.`);
      const bioOk = await authenticateWithBiometric(`₹${transferAmt}`);
      if (bioOk) {
        await speak(`₹${transferAmt} transferred to ${holderName} successfully!`);
        setShowSuccess(true);
      } else {
        await speak("Authentication cancelled.");
      }
    };

    setTimeout(runVoice, 800);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.accountNumber !== formData.reAccountNumber) {
      toast.error("Account numbers do not match");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const bioOk = await authenticateWithBiometric(`₹${amount}`);
    if (!bioOk) {
      await speak("Authentication cancelled.");
      return;
    }
    await speak(`₹${amount} transferred to ${formData.name} successfully!`);
    setShowSuccess(true);
  };

  const isFormValid = formData.accountNumber && formData.reAccountNumber && formData.ifsc && formData.name && amount;

  if (showSuccess) {
    return (
      <PaymentSuccess
        amount={amount}
        recipientName={`${formData.name} (A/C ${formData.accountNumber})`}
        onClose={() => { setShowSuccess(false); setAmount(""); setFormData({ accountNumber: "", reAccountNumber: "", ifsc: "", name: "" }); navigate("/"); }}
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
            <h1 className="text-lg font-bold text-foreground">Bank Transfer</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded-full hover:bg-muted transition-colors">
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded-full hover:bg-muted transition-colors">
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-4 py-6">
          <div className="flex items-center gap-4 bg-primary/10 rounded-xl p-4 mb-6 animate-fade-in-up">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Transfer to any bank account</p>
              <p className="text-[11px] text-muted-foreground">Instantly transfer money using IMPS/NEFT</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up stagger-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground px-1">Account Number</label>
              <input type="password" placeholder="Enter account number" value={formData.accountNumber}
                onChange={(e) => setFormData({...formData, accountNumber: e.target.value.replace(/[^0-9]/g, "")})}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground px-1">Re-enter Account Number</label>
              <input type="text" placeholder="Confirm account number" value={formData.reAccountNumber}
                onChange={(e) => setFormData({...formData, reAccountNumber: e.target.value.replace(/[^0-9]/g, "")})}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-muted-foreground px-1">IFSC Code</label>
              <input type="text" placeholder="e.g. SBIN0001234" value={formData.ifsc}
                onChange={(e) => setFormData({...formData, ifsc: e.target.value.toUpperCase()})}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all uppercase" />
            </div>
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-muted-foreground px-1">Account Holder Name</label>
              <input type="text" placeholder="Enter recipient's name" value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-muted-foreground px-1">Amount</label>
              <div className="flex items-center bg-card border border-border rounded-xl px-4 py-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span className="text-sm font-bold text-muted-foreground mr-1">₹</span>
                <input type="text" placeholder="0" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  className="flex-1 bg-transparent text-sm font-semibold text-foreground focus:outline-none" />
              </div>
            </div>
            <button type="submit" disabled={!isFormValid}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-6">
              Proceed Securely
            </button>
          </form>
        </div>
      </div>
    </MobileLayout>
  );
};

export default BankTransfer;
