import { ArrowLeft, Search, SlidersHorizontal, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MobileLayout from "@/components/MobileLayout";
import BottomNav from "@/components/BottomNav";
import TransactionItem from "@/components/TransactionItem";

const History = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchTransactions();
  }, [user]);

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select(`
        *,
        sender:profiles!transactions_sender_id_fkey(display_name, phone),
        receiver:profiles!transactions_receiver_id_fkey(display_name, phone)
      `)
      .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
      .order("created_at", { ascending: false });

    setTransactions(data || []);
    setLoading(false);
  };

  const filteredTx = transactions.filter((tx) => {
    const otherName = tx.sender_id === user?.id
      ? (tx.receiver?.display_name || tx.receiver?.phone || "")
      : (tx.sender?.display_name || tx.sender?.phone || "");
    return otherName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalSpent = transactions
    .filter((tx) => tx.sender_id === user?.id)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen">
        <div className="bg-gradient-to-br from-navy to-primary px-4 pt-4 pb-5 rounded-b-3xl">
          <div className="flex items-center gap-3 mb-4 animate-fade-in-up">
            <button onClick={() => navigate("/")} className="p-1.5 rounded-full hover:bg-primary-foreground/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-primary-foreground" />
            </button>
            <h1 className="text-lg font-bold text-primary-foreground">Payment History</h1>
          </div>

          <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-4 animate-fade-in-up stagger-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-primary-foreground/70 font-medium">Total Spent</p>
                <p className="text-2xl font-extrabold text-primary-foreground mt-0.5">₹{totalSpent.toLocaleString('en-IN')}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary-foreground/10 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 animate-fade-in-up stagger-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-4 py-2.5">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search payments"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm bg-transparent outline-none flex-1 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <button className="p-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 divide-y divide-border/50 animate-fade-in-up stagger-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTx.length > 0 ? (
            filteredTx.map((tx) => {
              const isSender = tx.sender_id === user?.id;
              const otherParty = isSender ? tx.receiver : tx.sender;
              const name = otherParty?.display_name || otherParty?.phone || "Unknown";
              const amount = Number(tx.amount);
              const date = new Date(tx.created_at);
              const time = `${isSender ? "Paid" : "Received"} ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;

              return (
                <TransactionItem
                  key={tx.id}
                  name={name}
                  amount={amount}
                  time={time}
                  category={isSender ? "Sent" : "Received"}
                  type={isSender ? "debit" : "credit"}
                />
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No transactions found</p>
            </div>
          )}
        </div>

        <BottomNav />
      </div>
    </MobileLayout>
  );
};

export default History;
