import { Home, Wallet, Clock, User, QrCode } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Wallet, label: "Balance", path: "/balance" },
  { icon: Clock, label: "History", path: "/history" },
  { icon: User, label: "Profile", path: "/profile" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="sticky bottom-0 bg-card/95 backdrop-blur-lg border-t border-border/50 flex justify-around items-end py-2 px-2 safe-area-inset-bottom">
      {navItems.slice(0, 2).map(({ icon: Icon, label, path }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-all duration-200 ${
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
            <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>{label}</span>
            {isActive && <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
          </button>
        );
      })}

      {/* Center QR button */}
      <button
        onClick={() => navigate("/scan")}
        className="flex flex-col items-center -mt-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform">
          <QrCode className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-[10px] font-medium text-primary mt-1">Scan</span>
      </button>

      {navItems.slice(2).map(({ icon: Icon, label, path }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-all duration-200 ${
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
            <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>{label}</span>
            {isActive && <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
          </button>
        );
      })}
    </div>
  );
};

export default BottomNav;
