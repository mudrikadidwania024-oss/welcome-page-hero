import { ArrowLeft, MoreVertical, Search, Plus, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import ContactAvatar from "@/components/ContactAvatar";
import PaymentSuccess from "@/components/PaymentSuccess";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { speak, listenOnce, extractDigits, extractAmount } from "@/lib/voice";
import { authenticateWithBiometric } from "@/lib/biometric";

interface Contact {
  name: string;
  phone: string;
}

const defaultContacts: Contact[] = [
  { name: "Aarav Patel", phone: "+91 98765 43210" },
  { name: "Amit Singh", phone: "+91 98765 43211" },
  { name: "Diya Rangarajan", phone: "+91 98765 43212" },
  { name: "Inayat Verma", phone: "+91 98765 43213" },
  { name: "Neha Gupta", phone: "+91 98765 43214" },
  { name: "Priya Sharma", phone: "+91 98765 43215" },
  { name: "Rishi Goli", phone: "+91 98765 43216" },
  { name: "Sahil Sehgal", phone: "+91 98765 43217" },
];

const recentContacts = [
  { name: "Inayat Verma" },
  { name: "Amit Singh" },
  { name: "Rishi Goli" },
  { name: "Sahil Sehgal" },
];

const askVoice = async (question: string, retries = 3): Promise<string> => {
  for (let i = 0; i < retries; i++) {
    const prompt = i === 0 ? question : "I didn't catch that. Please say it again.";
    await speak(prompt);
    try {
      const result = await listenOnce("en-IN");
      if (result && result.trim()) return result;
    } catch {}
  }
  return "";
};

const PayContact = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>(defaultContacts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const hasAutoSelected = useRef(false);
  const hasVoiceStarted = useRef(false);

  const doPayment = useCallback(async (contact: Contact, payAmount: string) => {
    if (!payAmount || Number(payAmount) <= 0) return;
    // Direct biometric — no voice confirm needed
    const bioOk = await authenticateWithBiometric(`₹${payAmount}`);
    if (!bioOk) return;
    setLoading(true);
    try {
      const rawDigits = contact.phone.replace(/\D/g, "");
      const last10 = rawDigits.slice(-10);
      const phoneVariants = [`91${last10}`, `+91${last10}`, last10];

      let receiverId: string | null = null;
      for (const pv of phoneVariants) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, phone")
          .eq("phone", pv)
          .maybeSingle();
        if (profile) {
          receiverId = profile.id;
          break;
        }
      }

      if (!receiverId) {
        throw new Error(`${contact.name} is not registered on VaaniPay.`);
      }

      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          receiver_id: receiverId,
          amount: Number(payAmount),
          description: `Payment to ${contact.name}`,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Payment failed");
      await speak(`₹${payAmount} sent to ${contact.name} successfully!`);
      setShowSuccess(true);
    } catch (err: any) {
      await speak(`Payment failed. ${err.message || ""}`);
      toast.error(err.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Voice flow when navigating here without auto-pay
  useEffect(() => {
    const state = location.state as { autoPayName?: string; autoPayAmount?: number; autoConfirm?: boolean } | null;
    if (state?.autoPayName) return;
    if (hasVoiceStarted.current) return;
    hasVoiceStarted.current = true;

    const runVoiceFlow = async () => {
      const answer = await askVoice("Pay Contacts. Say a contact name to pay, or say add new contact.");
      const lower = answer.toLowerCase();

      if (lower.includes("add") || lower.includes("new contact") || lower.includes("create")) {
        const nameAnswer = await askVoice("What is the contact name?");
        const name = nameAnswer.trim();
        if (!name) { await speak("Didn't catch the name."); return; }

        const phoneAnswer = await askVoice("Say the 10 digit phone number.");
        const digits = extractDigits(phoneAnswer);
        const phone = digits.length >= 10 ? digits.slice(0, 10) : "";
        if (!phone) { await speak("Didn't get the number."); return; }

        const contact: Contact = { name, phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` };
        setContacts(prev => [...prev, contact]);
        await speak(`Added ${name}. How much to send?`);
        
        const amtAnswer = await askVoice("");
        const amt = extractAmount(amtAnswer);
        if (amt) {
          setSelectedContact(contact);
          setAmount(String(amt));
          await speak(`Sending ₹${amt} to ${name}. Please authenticate.`);
          await doPayment(contact, String(amt));
        }
      } else {
        // Try to match a contact name
        const matched = contacts.find(c => lower.includes(c.name.split(" ")[0].toLowerCase()) || lower.includes(c.name.toLowerCase()));
        if (matched) {
          setSelectedContact(matched);
          const amtAnswer = await askVoice(`Selected ${matched.name}. How much to send?`);
          const amt = extractAmount(amtAnswer);
          if (amt) {
            setAmount(String(amt));
            await speak(`Sending ₹${amt} to ${matched.name}. Please authenticate.`);
            await doPayment(matched, String(amt));
          } else {
            const retry = await askVoice(`Didn't get the amount. How much to send to ${matched.name}?`);
            const retryAmt = extractAmount(retry);
            if (retryAmt) {
              setAmount(String(retryAmt));
              await speak(`Sending ₹${retryAmt} to ${matched.name}. Please authenticate.`);
              await doPayment(matched, String(retryAmt));
            }
          }
        } else {
          await speak("No contact found. Try again.");
        }
      }
    };

    setTimeout(runVoiceFlow, 800);
  }, [location.state, contacts, doPayment]);

  // Handle voice-initiated payment (from VoiceAssistant with autoPayName)
  useEffect(() => {
    if (hasAutoSelected.current) return;
    const state = location.state as { autoPayName?: string; autoPayAmount?: number; autoConfirm?: boolean } | null;
    if (state?.autoPayName) {
      hasAutoSelected.current = true;
      const name = state.autoPayName.toLowerCase();
      const found = contacts.find(c => c.name.toLowerCase().includes(name));
      if (found) {
        setSelectedContact(found);
        if (state.autoPayAmount) {
          setAmount(String(state.autoPayAmount));
          // Direct biometric — no confirm step
          (async () => {
            await speak(`Sending ₹${state.autoPayAmount} to ${found.name}. Please authenticate.`);
            await doPayment(found, String(state.autoPayAmount));
          })();
        } else {
          (async () => {
            const amtAnswer = await askVoice(`Found ${found.name}. How much to send?`);
            const amt = extractAmount(amtAnswer);
            if (amt) {
              setAmount(String(amt));
              await speak(`Sending ₹${amt} to ${found.name}. Please authenticate.`);
              await doPayment(found, String(amt));
            } else {
              const retry = await askVoice(`Didn't get the amount. How much for ${found.name}?`);
              const retryAmt = extractAmount(retry);
              if (retryAmt) {
                setAmount(String(retryAmt));
                await doPayment(found, String(retryAmt));
              } else {
                await speak("Couldn't get the amount. Please try again later.");
              }
            }
          })();
        }
      } else {
        (async () => {
          const retryName = await askVoice(`Couldn't find ${state.autoPayName}. Say the contact name again.`);
          const retryFound = contacts.find(c => c.name.toLowerCase().includes(retryName.toLowerCase()));
          if (retryFound) {
            setSelectedContact(retryFound);
            const amtAnswer = await askVoice(`Found ${retryFound.name}. How much to send?`);
            const amt = extractAmount(amtAnswer);
            if (amt) {
              setAmount(String(amt));
              await doPayment(retryFound, String(amt));
            }
          } else {
            await speak("Contact not found. Going back.");
            navigate("/");
          }
        })();
      }
    }
  }, [location.state, contacts, doPayment]);

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const handleAddContact = () => {
    if (!newName.trim() || newPhone.length < 10) {
      toast.error("Please enter valid name and phone number");
      return;
    }
    const contact: Contact = { name: newName.trim(), phone: `+91 ${newPhone.slice(0, 5)} ${newPhone.slice(5)}` };
    setContacts(prev => [...prev, contact]);
    setNewName("");
    setNewPhone("");
    setShowAddForm(false);
    toast.success("Contact added!");
  };

  const handlePay = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!selectedContact) return;
    await doPayment(selectedContact, amount);
  };

  if (showSuccess && selectedContact) {
    return (
      <PaymentSuccess
        amount={amount}
        recipientName={selectedContact.name}
        onClose={() => {
          setShowSuccess(false);
          setSelectedContact(null);
          setAmount("");
          setDescription("");
          navigate("/");
        }}
      />
    );
  }

  if (selectedContact) {
    return (
      <MobileLayout>
        <div className="flex flex-col min-h-screen">
          <div className="flex items-center justify-between px-4 py-3.5 bg-card border-b border-border/50 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedContact(null)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <h1 className="text-lg font-bold text-foreground">Pay {selectedContact.name}</h1>
            </div>
          </div>
          <div className="px-4 py-8 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-primary">{selectedContact.name[0]}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{selectedContact.phone}</p>
            <div className="flex items-center justify-center text-4xl font-bold text-foreground mb-4">
              <span className="text-muted-foreground mr-1">₹</span>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                className="w-32 bg-transparent outline-none text-center"
                autoFocus
              />
            </div>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a note (optional)"
              className="w-full bg-muted rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none mb-6"
            />
            <button
              onClick={handlePay}
              disabled={!amount || loading}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? "Processing..." : `Pay ₹${amount || "0"}`}
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
            <h1 className="text-lg font-bold text-foreground">Pay Contacts</h1>
          </div>
          <button onClick={() => setShowAddForm(true)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <Plus className="w-5 h-5 text-primary" />
          </button>
        </div>

        {showAddForm && (
          <div className="px-4 py-3 bg-muted/30 border-b border-border animate-fade-in-up">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-foreground">Add Contact</p>
              <button onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm mb-2 text-foreground" />
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value.replace(/[^0-9]/g, ""))} placeholder="10 digit phone"
              maxLength={10} className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm mb-2 text-foreground" />
            <button onClick={handleAddContact} className="w-full bg-primary text-primary-foreground text-sm font-bold py-2 rounded-lg">Add</button>
          </div>
        )}

        <div className="px-4 py-3">
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search contacts"
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
          </div>
        </div>

        <div className="px-4 mb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">RECENT</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {recentContacts.map((c) => (
              <ContactAvatar key={c.name} name={c.name} onClick={() => {
                const found = contacts.find(ct => ct.name === c.name);
                if (found) setSelectedContact(found);
              }} />
            ))}
          </div>
        </div>

        <div className="px-4 pb-8">
          <p className="text-xs font-semibold text-muted-foreground mb-2">ALL CONTACTS</p>
          <div className="space-y-1">
            {filteredContacts.map((contact) => (
              <button key={contact.name} onClick={() => setSelectedContact(contact)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{contact.name[0]}</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                  <p className="text-xs text-muted-foreground">{contact.phone}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default PayContact;
