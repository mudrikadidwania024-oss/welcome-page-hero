import { ArrowLeft, MoreVertical, Search, Zap, Droplets, Flame, Wifi, MonitorPlay, CreditCard } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import PaymentSuccess from "@/components/PaymentSuccess";
import { toast } from "sonner";
import { authenticateWithBiometric } from "@/lib/biometric";
import { speak, listenOnce, extractAmount, extractDigits, warmUpTTS } from "@/lib/voice";

const askVoice = async (question: string): Promise<string> => {
  await speak(question);
  try { return (await listenOnce("en-IN")) || ""; } catch { return ""; }
};

const categories = [
  { icon: Zap, label: "Electricity", color: "text-yellow-500", bg: "bg-yellow-500/10", amount: "1,240", provider: "BESCOM" },
  { icon: Droplets, label: "Water", color: "text-blue-500", bg: "bg-blue-500/10", amount: "450", provider: "BWSSB" },
  { icon: Flame, label: "Piped Gas", color: "text-orange-500", bg: "bg-orange-500/10", amount: "780", provider: "GAIL Gas" },
  { icon: Wifi, label: "Broadband", color: "text-emerald-500", bg: "bg-emerald-500/10", amount: "999", provider: "ACT Fibernet" },
  { icon: MonitorPlay, label: "DTH", color: "text-purple-500", bg: "bg-purple-500/10", amount: "399", provider: "Tata Play" },
  { icon: CreditCard, label: "Credit Card", color: "text-indigo-500", bg: "bg-indigo-500/10", amount: "5,200", provider: "HDFC Card" },
];

const PayBills = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<typeof categories[0] | null>(null);
  const [amount, setAmount] = useState("");
  const [consumerId, setConsumerId] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const hasAutoFilled = useRef(false);
  const hasVoiceStarted = useRef(false);

  // Auto-fill from voice navigation
  useEffect(() => {
    if (hasAutoFilled.current) return;
    const state = location.state as { autoBill?: string; autoAmount?: number; autoConsumerId?: string } | null;
    if (state?.autoBill) {
      hasAutoFilled.current = true;
      hasVoiceStarted.current = true;
      const found = categories.find(c => c.label.toLowerCase() === state.autoBill!.toLowerCase());
      if (found) {
        setSelectedCategory(found);
        if (state.autoAmount) setAmount(String(state.autoAmount));
        if (state.autoConsumerId) setConsumerId(state.autoConsumerId);
      }
    }
  }, [location.state]);

  // Voice flow on page open
  useEffect(() => {
    if (hasVoiceStarted.current) return;
    const state = location.state as { autoBill?: string } | null;
    if (state?.autoBill) return;
    hasVoiceStarted.current = true;

    const runVoice = async () => {
      const catList = categories.map(c => c.label).join(", ");
      const answer = await askVoice(
        `Pay Bills is open. Available categories are: ${catList}. Which bill would you like to pay?`
      );
      const lower = answer.toLowerCase();

      const matched = categories.find(c => lower.includes(c.label.toLowerCase()));
      if (!matched) {
        await speak("I didn't catch the category. Please select one manually.");
        return;
      }

      setSelectedCategory(matched);
      await speak(`${matched.label} bill selected. Provider: ${matched.provider}.`);

      const idAnswer = await askVoice("Please say your consumer or account ID.");
      const id = extractDigits(idAnswer) || idAnswer.trim();
      if (id) {
        setConsumerId(id);

        const amtAnswer = await askVoice(`How much is the ${matched.label} bill?`);
        const amt = extractAmount(amtAnswer);
        if (amt) {
          setAmount(String(amt));
          const confirmAnswer = await askVoice(
            `Paying ₹${amt} for ${matched.label} bill to ${matched.provider}. Consumer ID: ${id}. Say confirm or yes to proceed.`
          );
          const cLower = confirmAnswer.toLowerCase();
          if (cLower.includes("confirm") || cLower.includes("yes") || cLower.includes("haan") || cLower.includes("ok")) {
            await speak("Please authenticate with your fingerprint.");
            const bioOk = await authenticateWithBiometric(`₹${amt}`);
            if (bioOk) {
              await speak(`${matched.label} bill of ₹${amt} paid successfully to ${matched.provider}!`);
              setShowSuccess(true);
            } else {
              await speak("Authentication cancelled.");
            }
          } else {
            await speak("Payment cancelled. You can pay manually.");
          }
        } else {
          await speak("I didn't catch the amount. Please enter it manually.");
        }
      } else {
        await speak("I didn't catch the ID. Please enter it manually.");
      }
    };

    setTimeout(runVoice, 800);
  }, [location.state]);

  const filteredCategories = categories.filter(c =>
    c.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePay = async () => {
    if (!amount || Number(amount.replace(/,/g, "")) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!consumerId.trim()) {
      toast.error("Enter your Consumer/Account ID");
      return;
    }
    await speak("Please authenticate with your fingerprint.");
    const bioOk = await authenticateWithBiometric(`₹${amount}`);
    if (!bioOk) {
      await speak("Authentication cancelled.");
      return;
    }
    await speak(`${selectedCategory!.label} bill of ₹${amount} paid successfully!`);
    setShowSuccess(true);
  };

  if (showSuccess && selectedCategory) {
    return (
      <PaymentSuccess
        amount={amount.replace(/,/g, "")}
        recipientName={`${selectedCategory.provider} - ${selectedCategory.label}`}
        onClose={() => {
          setShowSuccess(false);
          setSelectedCategory(null);
          setAmount("");
          setConsumerId("");
          navigate("/");
        }}
      />
    );
  }

  if (selectedCategory) {
    return (
      <MobileLayout>
        <div className="flex flex-col min-h-screen">
          <div className="flex items-center justify-between px-4 py-3.5 bg-card border-b border-border/50 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedCategory(null)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <h1 className="text-lg font-bold text-foreground">{selectedCategory.label} Bill</h1>
            </div>
          </div>
          <div className="px-4 py-6">
            <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
              <div className={`w-12 h-12 rounded-2xl ${selectedCategory.bg} flex items-center justify-center`}>
                <selectedCategory.icon className={`w-6 h-6 ${selectedCategory.color}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{selectedCategory.provider}</p>
                <p className="text-xs text-muted-foreground">{selectedCategory.label}</p>
              </div>
            </div>

            <div className="space-y-4 animate-fade-in-up stagger-1">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Consumer / Account ID</label>
                <input type="text" value={consumerId} onChange={(e) => setConsumerId(e.target.value)}
                  placeholder="Enter your ID"
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm font-semibold text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" autoFocus />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Amount</label>
                <div className="flex items-center border border-border rounded-xl px-4 py-3 bg-card focus-within:ring-1 focus-within:ring-primary">
                  <span className="text-sm font-bold text-muted-foreground mr-1">₹</span>
                  <input type="text" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder={selectedCategory.amount}
                    className="flex-1 bg-transparent text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none" />
                </div>
              </div>
            </div>

            <button onClick={handlePay} disabled={!amount || !consumerId}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-8">
              Pay ₹{amount || "0"}
            </button>
          </div>
        </div>
      </MobileLayout>
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
            <h1 className="text-lg font-bold text-foreground">Pay Bills</h1>
          </div>
          <button className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2.5 mb-6 animate-fade-in-up">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search for biller" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-sm font-medium text-foreground w-full focus:outline-none placeholder:text-muted-foreground" />
          </div>

          <div className="mb-6 animate-fade-in-up stagger-1">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-foreground mb-1">Upcoming Bill</p>
                <p className="text-xs text-muted-foreground mb-3">BESCOM Electricity • Consumer ID: 123456</p>
                <p className="text-xl font-black text-foreground">₹ 1,240</p>
              </div>
              <button
                onClick={() => { setSelectedCategory(categories[0]); setAmount("1240"); setConsumerId("123456"); }}
                className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform">
                Pay Now
              </button>
            </div>
          </div>

          <div className="animate-fade-in-up stagger-2">
            <h3 className="text-sm font-bold text-foreground mb-4">Payment Categories</h3>
            <div className="grid grid-cols-4 gap-y-6 gap-x-2">
              {filteredCategories.map((cat, i) => (
                <button key={i} onClick={() => setSelectedCategory(cat)} className="flex flex-col items-center gap-2 group">
                  <div className={`w-12 h-12 rounded-2xl ${cat.bg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                    <cat.icon className={`w-6 h-6 ${cat.color}`} />
                  </div>
                  <span className="text-[11px] font-medium text-center text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-1">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default PayBills;
