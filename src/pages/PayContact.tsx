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
    const bioOk = await authenticateWithBiometric(`₹${payAmount}`);
    if (!bioOk) return;
    setLoading(true);
    try {
      const rawDigits = contact.phone.replace(/\D/g, "");
      const last10 = rawDigits.slice(-10);
      const phoneVariants = [`91${last10}`, `+91${last10}`, last10];

      // First look up receiver in profiles to get their ID
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
        throw new Error(`${contact.name} is not registered on VaaniPay. They need to sign up first.`);
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
      await speak(`Payment of ₹${payAmount} to ${contact.name} completed successfully!`);
      setShowSuccess(true);
    } catch (err: any) {
      await speak(`Payment failed. ${err.message || ""}`);
      toast.error(err.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Voice flow when navigating here without auto-pay (e.g. "open contacts")
  useEffect(() => {
    const state = location.state as { autoPayName?: string; autoPayAmount?: number; autoConfirm?: boolean } | null;
    if (state?.autoPayName) return; // handled by auto-pay effect
    if (hasVoiceStarted.current) return;
    hasVoiceStarted.current = true;

    const runVoiceFlow = async () => {
      const answer = await askVoice("You are in Pay Contacts. You can say: pay a contact name, add new contact, or search a contact. What would you like to do?");
      const lower = answer.toLowerCase();

      if (lower.includes("add") || lower.includes("new contact") || lower.includes("create")) {
        // Voice-guided add contact
        const nameAnswer = await askVoice("What is the contact name?");
        const name = nameAnswer.trim();
        if (!name) { await speak("I didn't catch the name."); return; }

        const phoneAnswer = await askVoice("What is the 10 digit phone number?");
        const digits = extractDigits(phoneAnswer);
        const phone = digits.length >= 10 ? digits.slice(0, 10) : "";
        if (!phone) { await speak("I didn't catch the phone number. Please try again later."); return; }

        const contact: Contact = { name, phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` };
        setContacts(prev => [...prev, contact]);
        await speak(`Contact ${name} with number ${phone} has been added successfully! Would you like to send money to ${name}?`);
        
        const sendAnswer = await askVoice("");
        const sendLower = sendAnswer.toLowerCase();
        if (sendLower.includes("yes") || sendLower.includes("haan") || sendLower.includes("send") || sendLower.includes("pay")) {
          setSelectedContact(contact);
          const amtAnswer = await askVoice(`How much do you want to send to ${name}?`);
          const amt = extractAmount(amtAnswer);
          if (amt) {
            setAmount(String(amt));
            const confirmAnswer = await askVoice(`Sending ₹${amt} to ${name}. Say confirm or yes to proceed.`);
            const cLower = confirmAnswer.toLowerCase();
            if (cLower.includes("confirm") || cLower.includes("yes") || cLower.includes("haan") || cLower.includes("ok")) {
              await doPayment(contact, String(amt));
            } else {
              await speak("Payment cancelled.");
            }
          }
        }
      } else if (lower.includes("search") || lower.includes("find")) {
        const searchAnswer = await askVoice("Who are you looking for?");
        setSearchQuery(searchAnswer.trim());
        const found = contacts.filter(c => c.name.toLowerCase().includes(searchAnswer.toLowerCase()));
        if (found.length > 0) {
          await speak(`Found ${found.map(c => c.name).join(", ")}. Would you like to pay one of them?`);
          const payAnswer = await askVoice("");
          const pLower = payAnswer.toLowerCase();
          const matched = found.find(c => pLower.includes(c.name.split(" ")[0].toLowerCase()));
          if (matched || (found.length === 1 && (pLower.includes("yes") || pLower.includes("pay")))) {
            const target = matched || found[0];
            setSelectedContact(target);
            const amtAnswer = await askVoice(`How much do you want to send to ${target.name}?`);
            const amt = extractAmount(amtAnswer);
            if (amt) {
              setAmount(String(amt));
              const confirmAnswer = await askVoice(`Sending ₹${amt} to ${target.name}. Say confirm or yes to proceed.`);
              const cLower2 = confirmAnswer.toLowerCase();
              if (cLower2.includes("confirm") || cLower2.includes("yes") || cLower2.includes("haan") || cLower2.includes("ok")) {
                await doPayment(target, String(amt));
              } else {
                await speak("Payment cancelled.");
              }
            }
          }
        } else {
          await speak(`No contacts found matching ${searchAnswer}. You can add a new contact or try again.`);
        }
      } else {
        // Try to match a contact name from what they said
        const matched = contacts.find(c => lower.includes(c.name.split(" ")[0].toLowerCase()) || lower.includes(c.name.toLowerCase()));
        if (matched) {
          setSelectedContact(matched);
          const amtAnswer = await askVoice(`Selected ${matched.name}. How much do you want to send?`);
          const amt = extractAmount(amtAnswer);
          if (amt) {
            setAmount(String(amt));
            const confirmAnswer = await askVoice(`Sending ₹${amt} to ${matched.name}. Say confirm or yes to proceed.`);
            const cLower = confirmAnswer.toLowerCase();
            if (cLower.includes("confirm") || cLower.includes("yes") || cLower.includes("haan") || cLower.includes("ok")) {
              await doPayment(matched, String(amt));
            } else {
              await speak("Payment cancelled.");
            }
          }
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
          if (state.autoConfirm) {
            // Already confirmed by voice assistant, proceed directly
            (async () => {
              await speak(`Processing payment of ₹${state.autoPayAmount} to ${found.name}.`);
              await doPayment(found, String(state.autoPayAmount));
            })();
          } else {
            // Ask for voice confirmation
            (async () => {
              const answer = await askVoice(`Found ${found.name}. Paying ₹${state.autoPayAmount}. Say confirm to proceed or cancel to stop.`);
              const lower = answer.toLowerCase();
              if (lower.includes("confirm") || lower.includes("yes") || lower.includes("haan") || lower.includes("ok") || lower.includes("proceed")) {
                await doPayment(found, String(state.autoPayAmount));
              } else {
                await speak("Payment cancelled.");
                toast.info("Payment cancelled by voice");
              }
            })();
          }
        } else {
          (async () => {
            const amtAnswer = await askVoice(`Found ${found.name}. How much do you want to send?`);
            const amt = extractAmount(amtAnswer);
            if (amt) {
              setAmount(String(amt));
              const confirmAnswer = await askVoice(`Sending ₹${amt} to ${found.name}. Say confirm or yes to proceed.`);
              const cLower = confirmAnswer.toLowerCase();
              if (cLower.includes("confirm") || cLower.includes("yes") || cLower.includes("haan") || cLower.includes("ok")) {
                await doPayment(found, String(amt));
              } else {
                await speak("Payment cancelled.");
              }
          } else {
              // Retry voice for amount instead of manual
              const retry = await askVoice(`I didn't get the amount. How much do you want to send to ${found.name}?`);
              const retryAmt = extractAmount(retry);
              if (retryAmt) {
                setAmount(String(retryAmt));
                const confirmRetry = await askVoice(`Sending ₹${retryAmt} to ${found.name}. Say confirm or yes to proceed.`);
                const crLower = confirmRetry.toLowerCase();
                if (crLower.includes("confirm") || crLower.includes("yes") || crLower.includes("haan") || crLower.includes("ok")) {
                  await doPayment(found, String(retryAmt));
                } else {
                  await speak("Payment cancelled.");
                }
              } else {
                await speak("I still couldn't get the amount. Please try again later.");
              }
            }
          })();
        }
      } else {
        // Contact not found - retry voice search
        (async () => {
          const retryName = await askVoice(`I couldn't find ${state.autoPayName} in your contacts. Please say the contact name again.`);
          const retryFound = contacts.find(c => c.name.toLowerCase().includes(retryName.toLowerCase()));
          if (retryFound) {
            setSelectedContact(retryFound);
            const amtAnswer = await askVoice(`Found ${retryFound.name}. How much do you want to send?`);
            const amt = extractAmount(amtAnswer);
            if (amt) {
              setAmount(String(amt));
              const confirmAnswer = await askVoice(`Sending ₹${amt} to ${retryFound.name}. Say confirm or yes to proceed.`);
              const cLower = confirmAnswer.toLowerCase();
              if (cLower.includes("confirm") || cLower.includes("yes") || cLower.includes("haan") || cLower.includes("ok")) {
                await doPayment(retryFound, String(amt));
              } else {
                await speak("Payment cancelled.");
              }
            }
          } else {
            await speak("Contact not found. Returning to home.");
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

        <div className="px-4 py-4">
          {showAddForm && (
            <div className="mb-4 bg-card border border-border rounded-xl p-4 animate-scale-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">Add New Contact</h3>
                <button onClick={() => setShowAddForm(false)} className="p-1 rounded-full hover:bg-muted">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground mb-2 focus:outline-none focus:ring-1 focus:ring-primary" />
              <input type="tel" placeholder="Phone number (10 digits)" value={newPhone} onChange={(e) => setNewPhone(e.target.value.replace(/[^0-9]/g, ""))} maxLength={10}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground mb-3 focus:outline-none focus:ring-1 focus:ring-primary" />
              <button onClick={handleAddContact} className="w-full bg-primary text-primary-foreground font-semibold py-2 rounded-lg text-sm">Add Contact</button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2.5 mb-6 animate-fade-in-up">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search any contact or number" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-sm font-medium text-foreground w-full focus:outline-none placeholder:text-muted-foreground" />
          </div>

          {!searchQuery && (
            <div className="mb-6 animate-fade-in-up stagger-1">
              <h3 className="text-sm font-bold text-foreground mb-3">Recents</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {recentContacts.map((contact) => (
                  <ContactAvatar key={contact.name} name={contact.name} />
                ))}
              </div>
            </div>
          )}

          <div className="animate-fade-in-up stagger-2">
            <h3 className="text-sm font-bold text-foreground mb-3">All Contacts on VaaniPay</h3>
            <div className="space-y-1">
              {filteredContacts.map((contact) => (
                <button key={contact.name + contact.phone} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-card hover:shadow-sm transition-all active:scale-[0.99] group border border-transparent hover:border-border/50"
                  onClick={() => setSelectedContact(contact)}>
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{contact.name[0]}</span>
                  </div>
                  <div className="text-left flex-1 border-b border-border/40 pb-3 group-hover:border-transparent transition-colors">
                    <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default PayContact;
