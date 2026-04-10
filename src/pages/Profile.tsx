import { ArrowLeft, ChevronRight, Shield, Bell, HelpCircle, Settings, LogOut, CreditCard, Gift, Star, Pencil, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MobileLayout from "@/components/MobileLayout";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

const menuItems = [
  { icon: CreditCard, label: "Payment Methods", desc: "Manage cards & bank accounts" },
  { icon: Shield, label: "Security & Privacy", desc: "Password, biometrics & more" },
  { icon: Bell, label: "Notifications", desc: "Alerts & preferences" },
  { icon: Gift, label: "Rewards & Offers", desc: "Cashback & discount coupons" },
  { icon: HelpCircle, label: "Help & Support", desc: "FAQ, chat & call support" },
  { icon: Settings, label: "Settings", desc: "Language, theme & more" },
];

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [txCount, setTxCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchTxCount();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .single();
    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || "");
    }
  };

  const fetchTxCount = async () => {
    const { count } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`);
    setTxCount(count || 0);
  };

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("id", user!.id);
    if (error) {
      toast.error("Failed to update name");
    } else {
      toast.success("Name updated!");
      setEditingName(false);
      fetchProfile();
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = (profile?.display_name || "U").charAt(0).toUpperCase();

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary to-blue-400 px-4 pt-4 pb-8 rounded-b-3xl">
          <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
            <button onClick={() => navigate("/")} className="p-1.5 rounded-full hover:bg-primary-foreground/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-primary-foreground" />
            </button>
            <h1 className="text-lg font-bold text-primary-foreground">Profile</h1>
          </div>
          <div className="flex items-center gap-4 animate-fade-in-up stagger-1">
            <div className="w-18 h-18 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center shadow-lg" style={{ width: 72, height: 72 }}>
              <span className="text-3xl font-extrabold text-primary-foreground">{initials}</span>
            </div>
            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-primary-foreground/20 text-primary-foreground rounded-lg px-2 py-1 text-lg font-bold outline-none"
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="p-1 rounded-full bg-primary-foreground/20">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-primary-foreground">
                    {profile?.display_name || "Set your name"}
                  </h2>
                  <button onClick={() => setEditingName(true)} className="p-1 rounded-full hover:bg-primary-foreground/10">
                    <Pencil className="w-3.5 h-3.5 text-primary-foreground/70" />
                  </button>
                </div>
              )}
              <p className="text-sm text-primary-foreground/70 font-medium">{profile?.phone || ""}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                <span className="text-[11px] font-bold text-primary-foreground/80">VaaniPay Member</span>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="mx-4 -mt-4 mb-4 animate-fade-in-up stagger-2">
          <div className="bg-card rounded-2xl shadow-lg p-5 flex flex-col items-center">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Your Payment QR Code</p>
            {profile?.qr_code_id ? (
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG
                  value={JSON.stringify({ type: "vaanipay", qr_code_id: profile.qr_code_id })}
                  size={160}
                  level="M"
                />
              </div>
            ) : (
              <div className="w-40 h-40 bg-muted rounded-xl animate-pulse" />
            )}
            <p className="text-[11px] text-muted-foreground mt-2">Share this QR to receive payments</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mx-4 mb-4 animate-fade-in-up stagger-3">
          <div className="bg-card rounded-2xl shadow-lg p-4 flex justify-around">
            <div className="text-center">
              <p className="text-lg font-extrabold text-foreground">{txCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Transactions</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className="text-lg font-extrabold text-foreground">
                ₹{profile ? Number(profile.balance).toLocaleString("en-IN") : "0"}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">Balance</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="flex-1 px-4 animate-fade-in-up stagger-4">
          <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
            {menuItems.map(({ icon: Icon, label, desc }, i) => (
              <button key={label} className={`w-full flex items-center gap-4 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors ${
                i < menuItems.length - 1 ? "border-b border-border/40" : ""
              }`}>
                <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 mt-4 mb-6 py-3.5 rounded-2xl border border-destructive/20 hover:bg-destructive/5 active:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">Log out</span>
          </button>
        </div>

        <BottomNav />
      </div>
    </MobileLayout>
  );
};

export default Profile;
