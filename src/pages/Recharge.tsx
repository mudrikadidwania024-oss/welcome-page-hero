import { ArrowLeft, MoreVertical, User, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { authenticateWithBiometric } from "@/lib/biometric";
import MobileLayout from "@/components/MobileLayout";
import ContactAvatar from "@/components/ContactAvatar";
import PaymentSuccess from "@/components/PaymentSuccess";
import { speak, listenOnce, extractDigits, extractAmount, warmUpTTS } from "@/lib/voice";

const askVoice = async (question: string): Promise<string> => {
  await speak(question);
  try { return (await listenOnce("en-IN")) || ""; } catch { return ""; }
};

const myRecharges = [
  { name: "Alisha Jacob", phone: "+91 98460 XXXXX", operator: "Vi", operatorColor: "bg-destructive" },
  { name: "Diya Rangarajan", phone: "+91 98460 XXXXX", operator: "Jio", operatorColor: "bg-primary" },
];

const suggestedContacts = [
  { name: "Vikram" },
  { name: "Priya" },
  { name: "Rahul" },
  { name: "Sonal" },
];

const operators = ["Jio", "Airtel", "Vi", "BSNL"];

const plans = [
  { amount: "149", validity: "24 days", data: "1GB/day", description: "Unlimited calls" },
  { amount: "299", validity: "28 days", data: "1.5GB/day", description: "Unlimited calls + 100 SMS/day" },
  { amount: "449", validity: "56 days", data: "2GB/day", description: "Unlimited calls + 100 SMS/day" },
  { amount: "599", validity: "84 days", data: "1.5GB/day", description: "Unlimited calls + 100 SMS/day" },
  { amount: "999", validity: "84 days", data: "2.5GB/day", description: "Unlimited calls + 100 SMS/day + OTT" },
];

const Recharge = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[0] | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const hasAutoFilled = useRef(false);
  const hasVoiceStarted = useRef(false);

  // Auto-fill from voice
  useEffect(() => {
    if (hasAutoFilled.current) return;
    const state = location.state as { autoPhone?: string; autoOperator?: string } | null;
    if (state?.autoPhone) {
      hasAutoFilled.current = true;
      hasVoiceStarted.current = true;
      setPhoneNumber(state.autoPhone);
      if (state.autoOperator) {
        const matched = operators.find(o => o.toLowerCase().includes(state.autoOperator!.toLowerCase()));
        if (matched) setSelectedOperator(matched);
      }
    }
  }, [location.state]);

  // Voice flow on page open
  useEffect(() => {
    if (hasVoiceStarted.current) return;
    const state = location.state as { autoPhone?: string } | null;
    if (state?.autoPhone) return;
    hasVoiceStarted.current = true;

    const runVoice = async () => {
      const phoneAnswer = await askVoice(
        "Mobile Recharge is open. Please say the 10 digit mobile number you want to recharge."
      );
      const digits = extractDigits(phoneAnswer);
      const phone = digits.length >= 10 ? digits.slice(0, 10) : "";

      if (!phone) {
        await speak("I didn't catch the number. Please enter it manually.");
        return;
      }

      setPhoneNumber(phone);

      const opAnswer = await askVoice(
        `Number ${phone} entered. Which operator? Available options are: ${operators.join(", ")}.`
      );
      const opLower = opAnswer.toLowerCase();
      const matchedOp = operators.find(o => opLower.includes(o.toLowerCase()));

      if (!matchedOp) {
        await speak("I didn't catch the operator. Please select it manually.");
        return;
      }

      setSelectedOperator(matchedOp);

      const planList = plans.map(p => `₹${p.amount} for ${p.validity}`).join(", ");
      const planAnswer = await askVoice(
        `${matchedOp} selected. Available plans: ${planList}. Which plan do you want? Say the amount.`
      );
      const planAmt = extractAmount(planAnswer);
      const matchedPlan = planAmt ? plans.find(p => p.amount === String(planAmt)) : null;

      if (!matchedPlan) {
        await speak("I didn't find that plan. Please select one manually.");
        return;
      }

      setSelectedPlan(matchedPlan);

      const confirmAnswer = await askVoice(
        `Recharging ${phone} with ${matchedOp} ₹${matchedPlan.amount} plan for ${matchedPlan.validity}. Say confirm or yes to proceed.`
      );
      const cLower = confirmAnswer.toLowerCase();
      if (cLower.includes("confirm") || cLower.includes("yes") || cLower.includes("haan") || cLower.includes("ok")) {
        await speak("Please authenticate with your fingerprint.");
        const bioOk = await authenticateWithBiometric(`₹${matchedPlan.amount}`);
        if (bioOk) {
          await speak(`Recharge of ₹${matchedPlan.amount} for ${phone} on ${matchedOp} completed successfully!`);
          setShowSuccess(true);
        } else {
          await speak("Authentication cancelled.");
        }
      } else {
        await speak("Recharge cancelled. You can recharge manually.");
      }
    };

    setTimeout(runVoice, 800);
  }, [location.state]);

  const handleRecharge = (phone: string) => {
    setPhoneNumber(phone.replace(/[^0-9]/g, "").slice(-10));
    toast.info("Number filled! Select a plan to proceed.");
  };

  const handlePay = async () => {
    if (!selectedPlan) {
      toast.error("Select a plan first");
      return;
    }
    await speak("Please authenticate with your fingerprint.");
    const bioOk = await authenticateWithBiometric(`₹${selectedPlan.amount}`);
    if (!bioOk) {
      await speak("Authentication cancelled.");
      return;
    }
    await speak(`Recharge of ₹${selectedPlan.amount} completed successfully!`);
    setShowSuccess(true);
  };

  if (showSuccess && selectedPlan) {
    return (
      <PaymentSuccess
        amount={selectedPlan.amount}
        recipientName={`${selectedOperator} Recharge • +91 ${phoneNumber}`}
        onClose={() => {
          setShowSuccess(false);
          setSelectedPlan(null);
          setPhoneNumber("");
          setSelectedOperator("");
          navigate("/");
        }}
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
            <h1 className="text-lg font-bold text-foreground">Mobile recharge</h1>
          </div>
          <button className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 py-5">
          <p className="text-sm font-semibold text-foreground mb-3 animate-fade-in-up">Enter mobile number</p>
          <div className="flex items-center gap-2 mb-6 animate-fade-in-up stagger-1">
            <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-3 bg-card hover:border-primary/30 transition-colors">
              <span className="text-lg">🇮🇳</span>
              <span className="text-sm font-semibold text-foreground">+91</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </div>
            <input type="tel" placeholder="Enter number" value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
              className="flex-1 border border-border rounded-xl px-4 py-3 text-sm font-semibold text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
              maxLength={10} />
            <button className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors">
              <User className="w-5 h-5 text-primary" />
            </button>
          </div>

          {phoneNumber.length === 10 && (
            <div className="mb-6 animate-fade-in-up">
              <p className="text-sm font-semibold text-foreground mb-2">Select operator</p>
              <div className="flex gap-2">
                {operators.map((op) => (
                  <button key={op} onClick={() => setSelectedOperator(op)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                      selectedOperator === op ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}>
                    {op}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedOperator && (
            <div className="mb-6 animate-fade-in-up">
              <h3 className="text-sm font-bold text-foreground mb-3">Browse Plans</h3>
              <div className="space-y-2">
                {plans.map((plan) => (
                  <button key={plan.amount} onClick={() => setSelectedPlan(plan)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.99] ${
                      selectedPlan?.amount === plan.amount ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/30"
                    }`}>
                    <div className="text-left flex-1">
                      <p className="text-sm font-bold text-foreground">₹{plan.amount}</p>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-foreground">{plan.validity}</p>
                      <p className="text-[10px] text-muted-foreground">{plan.data}</p>
                    </div>
                  </button>
                ))}
              </div>
              {selectedPlan && (
                <button onClick={handlePay}
                  className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl mt-4 active:scale-[0.98] transition-transform">
                  Recharge ₹{selectedPlan.amount}
                </button>
              )}
            </div>
          )}

          {!selectedOperator && (
            <>
              <div className="mb-6 animate-fade-in-up stagger-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground">My recharges</h3>
                  <button className="text-xs font-semibold text-primary">See all</button>
                </div>
                <div className="space-y-2">
                  {myRecharges.map((r) => (
                    <button key={r.name} onClick={() => handleRecharge(r.phone)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/50 hover:border-primary/20 hover:shadow-sm transition-all active:scale-[0.99]">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{r.name[0]}</span>
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold text-foreground">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.phone}</p>
                      </div>
                      <span className={`text-[10px] font-bold text-primary-foreground ${r.operatorColor} rounded-full px-2.5 py-1`}>{r.operator}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="animate-fade-in-up stagger-3">
                <h3 className="text-sm font-bold text-foreground mb-3">Suggested for you</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {suggestedContacts.map((c) => (
                    <ContactAvatar key={c.name} name={c.name} />
                  ))}
                </div>
              </div>

              <div className="mt-6 animate-fade-in-up stagger-4">
                <h3 className="text-sm font-bold text-foreground mb-3">Mobile operators</h3>
                <div className="grid grid-cols-4 gap-3">
                  {operators.map((op) => (
                    <button key={op} onClick={() => setSelectedOperator(op)} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-muted/50 hover:bg-muted transition-colors">
                      <div className="w-10 h-10 rounded-full bg-card shadow-sm flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{op[0]}</span>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground">{op}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MobileLayout>
  );
};

export default Recharge;
