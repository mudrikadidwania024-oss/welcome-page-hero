import { Search, QrCode, Contact, Phone, Building2, AtSign, ArrowLeftRight, Receipt, Smartphone, Copy, Bell, ChevronRight, Fingerprint, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MobileLayout from "@/components/MobileLayout";
import QuickAction from "@/components/QuickAction";
import ContactAvatar from "@/components/ContactAvatar";
import BottomNav from "@/components/BottomNav";
import heroBanner from "@/assets/hero-banner.jpg";
import { isBiometricAvailable, authenticateWithBiometric } from "@/lib/biometric";
import { speak } from "@/lib/voice";

const promotions = [
  { title: "₹15,00,000", subtitle: "Get Instant Cash", icon: "💰" },
  { title: "Save 5% Extra", subtitle: "Flat 5% on Bills", icon: "🏷️" },
];

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchRecentContacts();
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

  const fetchRecentContacts = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("receiver_id, profiles!transactions_receiver_id_fkey(display_name, phone)")
      .eq("sender_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      const seen = new Set();
      const unique = data.filter((tx: any) => {
        if (seen.has(tx.receiver_id)) return false;
        seen.add(tx.receiver_id);
        return true;
      });
      setRecentTx(unique);
    }
  };

  const handleShowBalance = async () => {
    if (balanceVisible) {
      setBalanceVisible(false);
      return;
    }
    setBalanceLoading(true);
    try {
      await speak("Please authenticate to view your balance.");
      const bioOk = await authenticateWithBiometric("view balance");
      if (bioOk) {
        setBalanceVisible(true);
        const bal = profile ? Number(profile.balance).toLocaleString("en-IN") : "0";
        await speak(`Your balance is ₹${bal}`);
      }
    } catch {
      // cancelled
    }
    setBalanceLoading(false);
  };

  const quickActions = [
    { icon: QrCode, label: "Scan QR", onClick: () => navigate("/scan") },
    { icon: Contact, label: "Pay Contacts", onClick: () => navigate("/pay-contact") },
    { icon: Phone, label: "Pay Phone", onClick: () => navigate("/pay-phone") },
    { icon: Building2, label: "Bank Transfer", onClick: () => navigate("/bank-transfer") },
    { icon: AtSign, label: "UPI ID", onClick: () => navigate("/upi") },
    { icon: ArrowLeftRight, label: "Self Transfer", onClick: () => navigate("/self-transfer") },
    { icon: Receipt, label: "Pay Bills", onClick: () => navigate("/pay-bills") },
    { icon: Smartphone, label: "Recharge", onClick: () => navigate("/recharge") },
  ];

  const handleCopyUPI = () => {
    const upiId = profile?.phone ? `${profile.phone.replace('+91', '')}@vaanipay` : "user@vaanipay";
    navigator.clipboard.writeText(upiId);
    toast.success("UPI ID copied!");
  };

  const displayName = profile?.display_name || "User";
  const initials = displayName.charAt(0).toUpperCase();
  const balance = profile ? Number(profile.balance).toLocaleString("en-IN") : "0";

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen">
        {/* Status Bar + Search */}
        <div className="bg-card px-4 pt-3 pb-2 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3 animate-fade-in-up">
            <div
              className={`flex-1 flex items-center gap-2 rounded-full px-4 py-2.5 transition-all duration-200 ${
                searchFocused ? "bg-card ring-2 ring-primary shadow-lg" : "bg-muted"
              }`}
            >
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Pay friends and merchants"
                className="text-sm bg-transparent outline-none flex-1 text-foreground placeholder:text-muted-foreground"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>
            <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
              <Bell className="w-5 h-5 text-foreground" strokeWidth={1.8} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </button>
            <button onClick={() => navigate("/profile")} className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center shadow-md">
              <span className="text-xs font-bold text-primary-foreground">{initials}</span>
            </button>
          </div>
        </div>

        {/* Balance Card — hidden until biometric */}
        <div className="px-4 pt-3 pb-1 animate-fade-in-up stagger-1">
          <div className="bg-gradient-to-br from-primary to-blue-400 rounded-2xl p-4 shadow-lg">
            <p className="text-sm text-primary-foreground/80 font-medium">Hello, {displayName}</p>
            <div className="flex items-center gap-3 mt-1">
              {balanceVisible ? (
                <p className="text-3xl font-extrabold text-primary-foreground">₹{balance}</p>
              ) : (
                <p className="text-3xl font-extrabold text-primary-foreground">₹ ••••••</p>
              )}
              <button
                onClick={handleShowBalance}
                disabled={balanceLoading}
                className="p-2 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors"
                aria-label={balanceVisible ? "Hide balance" : "Show balance with fingerprint"}
              >
                {balanceLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : balanceVisible ? (
                  <EyeOff className="w-5 h-5 text-primary-foreground" />
                ) : (
                  <Fingerprint className="w-5 h-5 text-primary-foreground" />
                )}
              </button>
            </div>
            <p className="text-xs text-primary-foreground/60 mt-1">
              {balanceVisible ? "Available Balance" : "Tap fingerprint to view balance"}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-3 py-3">
          <div className="grid grid-cols-4 gap-0.5">
            {quickActions.map((action, i) => (
              <div key={action.label} className={`animate-scale-in stagger-${i + 1}`}>
                <QuickAction icon={action.icon} label={action.label} onClick={action.onClick} />
              </div>
            ))}
          </div>
        </div>

        {/* UPI ID */}
        <div className="mx-4 mb-4 animate-fade-in-up stagger-4">
          <button
            onClick={handleCopyUPI}
            className="w-full flex items-center justify-center gap-2 bg-muted/60 hover:bg-muted rounded-full px-4 py-2.5 transition-colors active:scale-[0.98]"
          >
            <span className="text-xs font-medium text-muted-foreground">
              UPI ID: {profile?.phone ? `${profile.phone.replace('+91', '')}@vaanipay` : "user@vaanipay"}
            </span>
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Promotions */}
        <div className="px-4 mb-4 animate-fade-in-up stagger-5">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {promotions.map((promo) => (
              <div
                key={promo.title}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 min-w-[200px] shrink-0 hover:shadow-md transition-shadow cursor-pointer"
              >
                <span className="text-2xl">{promo.icon}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{promo.title}</p>
                  <p className="text-[11px] text-muted-foreground">{promo.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Contacts */}
        <div className="px-4 pb-24 animate-fade-in-up stagger-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-foreground">Recents</h3>
            <button onClick={() => navigate("/history")} className="flex items-center gap-0.5 text-xs font-semibold text-primary">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {recentTx.length > 0 ? (
              recentTx.map((tx: any) => (
                <ContactAvatar
                  key={tx.receiver_id}
                  name={(tx.profiles as any)?.display_name || (tx.profiles as any)?.phone || "Unknown"}
                  onClick={() => navigate("/pay-contact")}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent transactions</p>
            )}
          </div>
        </div>

        <div className="flex-1" />
        <BottomNav />
      </div>
    </MobileLayout>
  );
};

export default Index;
