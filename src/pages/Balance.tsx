import { ArrowLeft, Plus, ChevronRight, MoreVertical, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MobileLayout from "@/components/MobileLayout";
import BottomNav from "@/components/BottomNav";
import TransactionItem from "@/components/TransactionItem";

const Balance = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchTransactions();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .single();
    if (data) setProfile(data);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select(`
        *,
        sender:profiles!transactions_sender_id_fkey(display_name, phone),
        receiver:profiles!transactions_receiver_id_fkey(display_name, phone)
      `)
      .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
      .order("created_at", { ascending: false })
      .limit(10);

    setTransactions(data || []);
  };

  const balance = profile ? Number(profile.balance) : 0;

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen">
        <div className="bg-gradient-to-br from-navy to-primary px-4 pt-4 pb-6 rounded-b-3xl">
          <div className="flex items-center justify-between mb-5 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/")} className="p-1.5 rounded-full hover:bg-primary-foreground/10 transition-colors">
                <ArrowLeft className="w-5 h-5 text-primary-foreground" />
              </button>
              <h1 className="text-lg font-bold text-primary-foreground">Balance & History</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowBalance(!showBalance)} className="p-1.5 rounded-full hover:bg-primary-foreground/10">
                {showBalance ? <Eye className="w-4 h-4 text-primary-foreground" /> : <EyeOff className="w-4 h-4 text-primary-foreground" />}
              </button>
              <button className="p-1.5 rounded-full hover:bg-primary-foreground/10">
                <MoreVertical className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>
          </div>

          <div className="animate-fade-in-up stagger-1">
            <h2 className="text-sm font-semibold text-primary-foreground/80 mb-2">Your Balance</h2>
            <div className="bg-gradient-to-br from-primary to-blue-400 rounded-2xl p-5 shadow-lg">
              <p className="text-sm text-primary-foreground/70 font-medium">VaaniPay Wallet</p>
              <p className="text-3xl font-extrabold text-primary-foreground mt-1">
                {showBalance ? `₹${balance.toLocaleString("en-IN")}` : "₹•••••"}
              </p>
              <button className="flex items-center gap-1 mt-3 bg-primary-foreground/20 rounded-full px-3 py-1.5 hover:bg-primary-foreground/30 transition-colors">
                <Plus className="w-3 h-3 text-primary-foreground" />
                <span className="text-[11px] font-medium text-primary-foreground">Add Money</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-card mt-4 rounded-t-3xl">
          <div className="px-4 pt-5 pb-3 animate-fade-in-up stagger-2">
            <h2 className="text-lg font-bold text-foreground mb-3">Recent Payments</h2>
          </div>

          <div className="divide-y divide-border/50 animate-fade-in-up stagger-3">
            {transactions.length > 0 ? (
              transactions.map((tx) => {
                const isSender = tx.sender_id === user?.id;
                const otherParty = isSender ? tx.receiver : tx.sender;
                const name = otherParty?.display_name || otherParty?.phone || "Unknown";
                const amount = Number(tx.amount);
                const date = new Date(tx.created_at);
                const time = `${isSender ? "Paid" : "Received"} ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;

                return (
                  <TransactionItem
                    key={tx.id}
                    name={name}
                    amount={isSender ? amount : -amount}
                    time={time}
                    category={isSender ? "Sent" : "Received"}
                  />
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No transactions yet
              </div>
            )}
          </div>
        </div>

        <BottomNav />
      </div>
    </MobileLayout>
  );
};

export default Balance;
