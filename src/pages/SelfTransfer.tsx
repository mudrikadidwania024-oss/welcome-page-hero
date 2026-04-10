import { ArrowLeft, MoreVertical, ArrowDown, Building2, Plus, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import PaymentSuccess from "@/components/PaymentSuccess";
import { toast } from "sonner";
import { speak, listenOnce, extractAmount, warmUpTTS } from "@/lib/voice";
import { authenticateWithBiometric } from "@/lib/biometric";

const askVoice = async (question: string): Promise<string> => {
  await speak(question);
  try { return (await listenOnce("en-IN")) || ""; } catch { return ""; }
};

interface BankAccount {
  name: string;
  accountNo: string;
  color: string;
  bgColor: string;
}

const demoAccounts: BankAccount[] = [
  { name: "HDFC Bank", accountNo: "•••• 1234", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40" },
  { name: "ICICI Bank", accountNo: "•••• 9876", color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/40" },
  { name: "SBI", accountNo: "•••• 5678", color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-100 dark:bg-indigo-900/40" },
  { name: "Axis Bank", accountNo: "•••• 4321", color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/40" },
];

const SelfTransfer = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>(demoAccounts);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newAccountNo, setNewAccountNo] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const hasVoiceStarted = useRef(false);

  // Voice flow on page open
  useEffect(() => {
    if (hasVoiceStarted.current) return;
    hasVoiceStarted.current = true;

    const runVoice = async () => {
      const accountList = accounts.map((a, i) => `${i + 1}. ${a.name}`).join(", ");
      const answer = await askVoice(
        `Self Transfer is open. Your accounts are: ${accountList}. ` +
        `Currently transferring from ${accounts[0].name} to ${accounts[1].name}. ` +
        `You can say: transfer amount, swap accounts, add new account, or go back.`
      );
      const lower = answer.toLowerCase();

      if (lower.includes("add") || lower.includes("new")) {
        setShowAddForm(true);
        const bankName = await askVoice("Please say the bank name.");
        if (bankName) {
          setNewBankName(bankName);
          const acNo = await askVoice("Please say the last 4 digits of the account number.");
          const digits = acNo.replace(/[^0-9]/g, "");
          if (digits.length >= 4) {
            setNewAccountNo(digits.slice(-4));
            await speak(`Adding ${bankName} account ending ${digits.slice(-4)}. Done!`);
            setAccounts(prev => [...prev, {
              name: bankName.trim(),
              accountNo: `•••• ${digits.slice(-4)}`,
              color: "text-emerald-600 dark:text-emerald-400",
              bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
            }]);
            setShowAddForm(false);
            toast.success("Account added!");
          }
        }
        return;
      }

      if (lower.includes("swap")) {
        setFromIdx(1);
        setToIdx(0);
        await speak(`Swapped. Now transferring from ${accounts[1].name} to ${accounts[0].name}.`);
        return;
      }

      if (lower.includes("back") || lower.includes("home")) {
        navigate("/");
        return;
      }

      // Try to extract amount
      const amt = extractAmount(answer);
      if (amt) {
        setAmount(String(amt));
        const confirmAnswer = await askVoice(
          `Transferring ₹${amt} from ${accounts[0].name} to ${accounts[1].name}. Say confirm or yes to proceed.`
        );
        const cLower = confirmAnswer.toLowerCase();
        if (cLower.includes("confirm") || cLower.includes("yes") || cLower.includes("haan") || cLower.includes("ok")) {
          await speak("Please authenticate with your fingerprint.");
          const bioOk = await authenticateWithBiometric(`₹${amt}`);
          if (bioOk) {
            await speak(`₹${amt} transferred successfully from ${accounts[0].name} to ${accounts[1].name}!`);
            setShowSuccess(true);
          } else {
            await speak("Authentication cancelled. Transfer not processed.");
          }
        } else {
          await speak("Transfer cancelled. You can enter the amount manually.");
        }
      } else {
        await speak("You can enter the amount and transfer manually.");
      }
    };

    setTimeout(runVoice, 800);
  }, []);

  const handleSwap = () => {
    setFromIdx(toIdx);
    setToIdx(fromIdx);
  };

  const handleAddAccount = () => {
    if (!newBankName.trim() || newAccountNo.length < 4) {
      toast.error("Please enter valid bank name and last 4 digits");
      return;
    }
    setAccounts(prev => [...prev, {
      name: newBankName.trim(),
      accountNo: `•••• ${newAccountNo.slice(-4)}`,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
    }]);
    setNewBankName("");
    setNewAccountNo("");
    setShowAddForm(false);
    toast.success("Account added!");
  };

  const handleTransfer = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    await speak("Please authenticate with your fingerprint to confirm the transfer.");
    const bioOk = await authenticateWithBiometric(`₹${amount}`);
    if (!bioOk) {
      await speak("Authentication cancelled.");
      return;
    }
    await speak(`₹${amount} transferred successfully from ${accounts[fromIdx].name} to ${accounts[toIdx].name}!`);
    setShowSuccess(true);
  };

  if (showSuccess) {
    return (
      <PaymentSuccess
        amount={amount}
        recipientName={`${accounts[toIdx].name} (${accounts[toIdx].accountNo})`}
        onClose={() => {
          setShowSuccess(false);
          setAmount("");
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
            <h1 className="text-lg font-bold text-foreground">Self Transfer</h1>
          </div>
          <button onClick={() => setShowAddForm(true)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <Plus className="w-5 h-5 text-primary" />
          </button>
        </div>

        <div className="px-4 py-6">
          {showAddForm && (
            <div className="mb-4 bg-card border border-border rounded-xl p-4 animate-scale-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">Add Bank Account</h3>
                <button onClick={() => setShowAddForm(false)} className="p-1 rounded-full hover:bg-muted">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <input type="text" placeholder="Bank name (e.g. Kotak Mahindra)" value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground mb-2 focus:outline-none focus:ring-1 focus:ring-primary" />
              <input type="text" placeholder="Last 4 digits of A/C" value={newAccountNo}
                onChange={(e) => setNewAccountNo(e.target.value.replace(/[^0-9]/g, ""))}
                maxLength={4}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground mb-3 focus:outline-none focus:ring-1 focus:ring-primary" />
              <button onClick={handleAddAccount} className="w-full bg-primary text-primary-foreground font-semibold py-2 rounded-lg text-sm">
                Add Account
              </button>
            </div>
          )}

          <div className="relative animate-fade-in-up">
            <div className="bg-card border border-border rounded-xl p-4 mb-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Transfer from</p>
              <select value={fromIdx} onChange={(e) => { const idx = Number(e.target.value); if (idx === toIdx) setToIdx(fromIdx); setFromIdx(idx); }}
                className="w-full bg-transparent text-sm font-bold text-foreground focus:outline-none">
                {accounts.map((a, i) => <option key={i} value={i}>{a.name} — A/C No. {a.accountNo}</option>)}
              </select>
            </div>
            <button onClick={handleSwap}
              className="absolute top-1/2 left-8 -translate-y-1/2 w-8 h-8 bg-background border border-border rounded-full flex items-center justify-center shadow-sm z-10 hover:bg-muted cursor-pointer transition-colors">
              <ArrowDown className="w-4 h-4 text-primary" />
            </button>
            <div className="bg-card border border-border rounded-xl p-4 mt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Transfer to</p>
              <select value={toIdx} onChange={(e) => { const idx = Number(e.target.value); if (idx === fromIdx) setFromIdx(toIdx); setToIdx(idx); }}
                className="w-full bg-transparent text-sm font-bold text-foreground focus:outline-none">
                {accounts.map((a, i) => <option key={i} value={i}>{a.name} — A/C No. {a.accountNo}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-8 animate-fade-in-up stagger-1">
            <div className="flex items-center justify-center text-4xl font-bold text-foreground mb-6">
              <span className="text-muted-foreground mr-1">₹</span>
              <input type="text" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0" className="w-24 bg-transparent outline-none text-center" autoFocus />
            </div>
            <button onClick={handleTransfer} disabled={!amount}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
              Transfer funds
            </button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default SelfTransfer;
